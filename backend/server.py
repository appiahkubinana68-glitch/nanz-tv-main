from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Cookie, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import time
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
import httpx
from datetime import datetime, timezone, timedelta


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# ---------- Models ----------
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime

class WatchlistEntry(BaseModel):
    entry_id: str
    user_id: str
    mal_id: int
    title: str
    image: Optional[str] = None
    status: str  # watching | completed | plan_to_watch | dropped
    updated_at: datetime

class WatchlistCreate(BaseModel):
    mal_id: int
    title: str
    image: Optional[str] = None
    status: str

class FavoriteEntry(BaseModel):
    entry_id: str
    user_id: str
    mal_id: int
    title: str
    image: Optional[str] = None
    created_at: datetime

class FavoriteCreate(BaseModel):
    mal_id: int
    title: str
    image: Optional[str] = None

class RatingCreate(BaseModel):
    mal_id: int
    score: int  # 1-5

class CommentCreate(BaseModel):
    text: str

class Comment(BaseModel):
    comment_id: str
    mal_id: int
    user_id: str
    user_name: str
    user_picture: Optional[str] = None
    text: str
    created_at: datetime

class CustomAnimeCreate(BaseModel):
    title: str
    synopsis: str
    image_url: str
    year: Optional[int] = None
    type: Optional[str] = "TV"
    status: Optional[str] = "Finished Airing"
    episodes: Optional[int] = None
    genres: List[str] = []
    trailer_youtube_id: Optional[str] = None

# ---------- Cache ----------
_cache: Dict[str, Dict[str, Any]] = {}

async def cached_jikan_get(path: str, params: Optional[Dict[str, Any]] = None, ttl: int = 600) -> Dict[str, Any]:
    key = f"{path}::{params}"
    now = time.time()
    entry = _cache.get(key)
    if entry and entry["expires"] > now:
        return entry["data"]
    url = f"https://api.jikan.moe/v4{path}"
    async with httpx.AsyncClient(timeout=20.0) as hc:
        # Jikan rate limit is ~3/sec; retry on 429
        for attempt in range(3):
            r = await hc.get(url, params=params or {})
            if r.status_code == 429:
                await asyncio.sleep(1.2 * (attempt + 1))
                continue
            r.raise_for_status()
            data = r.json()
            _cache[key] = {"data": data, "expires": now + ttl}
            return data
    raise HTTPException(status_code=502, detail="Upstream rate-limited")


# ---------- Auth ----------
async def get_current_user_from_request(request: Request) -> Optional[User]:
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            token = auth[7:]
    if not token:
        return None
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < datetime.now(timezone.utc):
        return None
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        return None
    if isinstance(user.get("created_at"), str):
        user["created_at"] = datetime.fromisoformat(user["created_at"])
    return User(**user)


async def require_user(request: Request) -> User:
    user = await get_current_user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def _admin_emails() -> set:
    raw = os.environ.get("ADMIN_EMAILS", "")
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


async def require_admin(request: Request) -> User:
    user = await require_user(request)
    if user.email.lower() not in _admin_emails():
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@api_router.get("/auth/is-admin")
async def auth_is_admin(request: Request):
    user = await get_current_user_from_request(request)
    return {"is_admin": bool(user and user.email.lower() in _admin_emails())}



@api_router.post("/auth/session")
async def auth_session(request: Request, response: Response):
    """Exchange session_id from Emergent for a session_token cookie."""
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        body = await request.json()
        session_id = body.get("session_id") if body else None
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session_id")

    async with httpx.AsyncClient(timeout=15.0) as hc:
        r = await hc.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
        )
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session_id")
        data = r.json()

    email = data["email"]
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": data.get("name"), "picture": data.get("picture")}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": data.get("name", ""),
            "picture": data.get("picture"),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    session_token = data["session_token"]
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc),
    })

    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=7 * 24 * 3600,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": {"user_id": user_doc["user_id"], "email": user_doc["email"], "name": user_doc["name"], "picture": user_doc.get("picture")}}


@api_router.get("/auth/me")
async def auth_me(request: Request):
    user = await get_current_user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"user_id": user.user_id, "email": user.email, "name": user.name, "picture": user.picture}


@api_router.post("/auth/logout")
async def auth_logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/", samesite="none", secure=True)
    return {"ok": True}


# ---------- Anime endpoints (proxy Jikan + merged with custom) ----------
@api_router.get("/anime/trending")
async def anime_trending():
    data = await cached_jikan_get("/top/anime", {"filter": "airing", "limit": 20})
    return data

@api_router.get("/anime/top")
async def anime_top():
    data = await cached_jikan_get("/top/anime", {"limit": 20})
    return data

@api_router.get("/anime/popular")
async def anime_popular():
    data = await cached_jikan_get("/top/anime", {"filter": "bypopularity", "limit": 20})
    return data

@api_router.get("/anime/upcoming")
async def anime_upcoming():
    data = await cached_jikan_get("/top/anime", {"filter": "upcoming", "limit": 20})
    return data

@api_router.get("/anime/season")
async def anime_season():
    data = await cached_jikan_get("/seasons/now", {"limit": 20})
    return data

@api_router.get("/anime/genres")
async def anime_genres():
    data = await cached_jikan_get("/genres/anime", {}, ttl=86400)
    return data

@api_router.get("/anime/browse")
async def anime_browse(
    q: Optional[str] = None,
    genres: Optional[str] = None,
    type: Optional[str] = None,
    status: Optional[str] = None,
    order_by: Optional[str] = "popularity",
    sort: Optional[str] = "asc",
    page: int = 1,
    limit: int = 24,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    params: Dict[str, Any] = {"page": page, "limit": limit, "order_by": order_by, "sort": sort, "sfw": True}
    if q:
        params["q"] = q
    if genres:
        params["genres"] = genres
    if type:
        params["type"] = type
    if status:
        params["status"] = status
    if start_date:
        params["start_date"] = start_date
    if end_date:
        params["end_date"] = end_date
    data = await cached_jikan_get("/anime", params, ttl=300)
    return data

@api_router.get("/anime/custom")
async def list_custom_anime():
    items = await db.custom_anime.find({}, {"_id": 0}).to_list(500)
    return {"data": items}

@api_router.post("/anime/custom")
async def create_custom_anime(payload: CustomAnimeCreate, request: Request):
    user = await require_admin(request)
    doc = payload.model_dump()
    doc["mal_id"] = -int(uuid.uuid4().int % 1_000_000)  # negative id to avoid jikan collisions
    doc["custom_id"] = uuid.uuid4().hex
    doc["created_by"] = user.user_id
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.custom_anime.insert_one(doc)
    return await db.custom_anime.find_one({"custom_id": doc["custom_id"]}, {"_id": 0})

@api_router.get("/anime/{mal_id}")
async def anime_detail(mal_id: int):
    # If negative, look up custom
    if mal_id < 0:
        item = await db.custom_anime.find_one({"mal_id": mal_id}, {"_id": 0})
        if not item:
            raise HTTPException(status_code=404, detail="Not found")
        return {"data": {
            "mal_id": item["mal_id"],
            "title": item["title"],
            "synopsis": item["synopsis"],
            "year": item.get("year"),
            "type": item.get("type"),
            "status": item.get("status"),
            "episodes": item.get("episodes"),
            "genres": [{"name": g} for g in item.get("genres", [])],
            "images": {"jpg": {"large_image_url": item.get("image_url"), "image_url": item.get("image_url")}},
            "trailer": {"youtube_id": item.get("trailer_youtube_id"), "url": None, "embed_url": None},
            "is_custom": True,
        }}
    data = await cached_jikan_get(f"/anime/{mal_id}/full", ttl=900)
    return data

@api_router.get("/anime/{mal_id}/recommendations")
async def anime_recs(mal_id: int):
    if mal_id < 0:
        return {"data": []}
    try:
        data = await cached_jikan_get(f"/anime/{mal_id}/recommendations", ttl=900)
        return data
    except Exception:
        return {"data": []}


# ---------- Episodes ----------
@api_router.get("/anime/{mal_id}/episodes")
async def anime_episodes(mal_id: int, page: int = 1):
    if mal_id < 0:
        item = await db.custom_anime.find_one({"mal_id": mal_id}, {"_id": 0})
        eps = item.get("episodes") if item else None
        if not eps:
            return {"data": [], "pagination": {"has_next_page": False, "last_visible_page": 1}}
        return {"data": [{"mal_id": i, "title": f"Episode {i}", "aired": None, "filler": False, "recap": False} for i in range(1, eps + 1)], "pagination": {"has_next_page": False, "last_visible_page": 1}}
    try:
        data = await cached_jikan_get(f"/anime/{mal_id}/episodes", {"page": page}, ttl=1800)
        return data
    except Exception:
        return {"data": [], "pagination": {"has_next_page": False, "last_visible_page": 1}}


# ---------- Streaming (AniList + admin overrides) ----------
ALLOWED_STREAMERS = {
    "crunchyroll": "Crunchyroll",
    "netflix": "Netflix",
    "amazon prime video": "Amazon Prime Video",
    "amazon": "Amazon Prime Video",
    "hulu": "Hulu",
    "tubi": "Tubi",
    "tubitv": "Tubi",
    "pluto tv": "Pluto TV",
    "plutotv": "Pluto TV",
    "retrocrush": "RetroCrush",
}

ANILIST_QUERY = """
query ($idMal: Int) {
  Media(idMal: $idMal, type: ANIME) {
    id
    externalLinks { site url type }
  }
}
"""

async def fetch_anilist_streaming(mal_id: int):
    cache_key = f"anilist::{mal_id}"
    entry = _cache.get(cache_key)
    if entry and entry["expires"] > time.time():
        return entry["data"]
    try:
        async with httpx.AsyncClient(timeout=10.0) as hc:
            r = await hc.post("https://graphql.anilist.co", json={"query": ANILIST_QUERY, "variables": {"idMal": mal_id}})
            if r.status_code != 200:
                return []
            d = r.json()
            links = (d.get("data", {}) or {}).get("Media", {}) or {}
            ext = links.get("externalLinks") or []
            out = []
            seen = set()
            for link in ext:
                site = (link.get("site") or "").strip()
                key = site.lower()
                norm = None
                for k, name in ALLOWED_STREAMERS.items():
                    if k in key:
                        norm = name; break
                if not norm or norm in seen:
                    continue
                seen.add(norm)
                out.append({"site": norm, "url": link.get("url")})
            _cache[cache_key] = {"data": out, "expires": time.time() + 86400}
            return out
    except Exception:
        return []


class StreamingOverrideCreate(BaseModel):
    links: List[Dict[str, str]]  # [{"site": "Crunchyroll", "url": "..."}]


@api_router.get("/anime/{mal_id}/streaming")
async def get_streaming(mal_id: int):
    override = await db.streaming_overrides.find_one({"mal_id": mal_id}, {"_id": 0})
    if mal_id < 0:
        return {"data": (override or {}).get("links", []), "source": "admin" if override else "none"}
    anilist_links = await fetch_anilist_streaming(mal_id)
    if override and override.get("links"):
        # Override-first: admin URLs win when the same site is set
        by_site = {l["site"]: l for l in anilist_links}
        for l in override["links"]:
            by_site[l["site"]] = l
        return {"data": list(by_site.values()), "source": "merged"}
    return {"data": anilist_links, "source": "anilist"}


@api_router.post("/anime/{mal_id}/streaming-overrides")
async def set_streaming_override(mal_id: int, payload: StreamingOverrideCreate, request: Request):
    user = await require_admin(request)
    # Validate sites against allowlist
    cleaned = []
    allowed_names = set(ALLOWED_STREAMERS.values())
    for l in payload.links:
        site = l.get("site", "").strip()
        url = l.get("url", "").strip()
        if site in allowed_names and url.startswith("http"):
            cleaned.append({"site": site, "url": url})
    await db.streaming_overrides.update_one(
        {"mal_id": mal_id},
        {"$set": {"mal_id": mal_id, "links": cleaned, "updated_by": user.user_id, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"mal_id": mal_id, "links": cleaned}


@api_router.get("/streaming/allowed")
async def list_allowed_streamers():
    return {"data": sorted(set(ALLOWED_STREAMERS.values()))}


# ---------- Licensed YouTube Anime Channels (embeddable) ----------
# Channel IDs verified as official licensed anime distributors that permit embedding
LICENSED_YT_CHANNELS = {
    "UCGwu0nbY2wSkW8N-cghnLpA": "Muse Asia",
    "UC0wNSTMWIL3qaorLx0jie6A": "Ani-One Asia",
    "UC6pGDc4bFGD1_36IKv3FnYg": "Crunchyroll Collection",
    "UCo7a6riBFJ3tkeHjbkbtEdg": "GKIDS Films",
    "UCkdhpvfDmoP1NPnXgEH9JoQ": "RetroCrush",
    "UC1nelqxRBOWlsbXtXxnj_NQ": "Ani-One Asia Classic",
    "UCH4tGFn7CY-i-V_5ZTzVbqg": "Ani-One Italia",
}


class EpisodeSourceCreate(BaseModel):
    mal_id: int
    episode_number: int
    youtube_video_id: str
    channel_name: Optional[str] = None
    quality_label: Optional[str] = "Auto"
    title: Optional[str] = None


@api_router.get("/youtube/channels")
async def list_licensed_channels():
    return {"data": [{"id": k, "name": v} for k, v in LICENSED_YT_CHANNELS.items()]}


async def _search_youtube_for_episode(anime_title: str, ep_num: int) -> List[Dict[str, str]]:
    """Use YouTube Data API to find official episode uploads on licensed channels only."""
    api_key = os.environ.get("YOUTUBE_API_KEY", "").strip()
    if not api_key:
        return []
    queries = [
        f"{anime_title} episode {ep_num} english sub",
        f"{anime_title} ep {ep_num}",
    ]
    results: List[Dict[str, str]] = []
    seen_video_ids = set()
    async with httpx.AsyncClient(timeout=10.0) as hc:
        for q in queries:
            try:
                r = await hc.get(
                    "https://www.googleapis.com/youtube/v3/search",
                    params={
                        "part": "snippet",
                        "q": q,
                        "type": "video",
                        "videoEmbeddable": "true",
                        "maxResults": 10,
                        "key": api_key,
                    },
                )
                if r.status_code != 200:
                    continue
                items = r.json().get("items", [])
                for it in items:
                    sn = it.get("snippet", {})
                    ch_id = sn.get("channelId")
                    if ch_id not in LICENSED_YT_CHANNELS:
                        continue
                    vid = it.get("id", {}).get("videoId")
                    if not vid or vid in seen_video_ids:
                        continue
                    seen_video_ids.add(vid)
                    results.append({
                        "youtube_video_id": vid,
                        "channel_id": ch_id,
                        "channel_name": LICENSED_YT_CHANNELS[ch_id],
                        "title": sn.get("title"),
                        "thumbnail": (sn.get("thumbnails", {}).get("medium") or {}).get("url"),
                    })
            except Exception:
                continue
    return results


@api_router.get("/anime/{mal_id}/episodes/{ep_num}/sources")
async def get_episode_sources(mal_id: int, ep_num: int, anime_title: Optional[str] = None):
    """Return embeddable YouTube sources for a given anime+episode.
    Order: 1) admin-curated manual entries, 2) cached auto-discovered, 3) fresh YouTube search."""
    manuals = await db.episode_sources.find(
        {"mal_id": mal_id, "episode_number": ep_num},
        {"_id": 0},
    ).sort("created_at", -1).to_list(50)

    sources = []
    seen = set()
    for m in manuals:
        vid = m.get("youtube_video_id")
        if vid and vid not in seen:
            seen.add(vid)
            sources.append({
                "id": m.get("source_id"),
                "youtube_video_id": vid,
                "channel_name": m.get("channel_name") or "Manual",
                "quality_label": m.get("quality_label", "Auto"),
                "title": m.get("title"),
                "manual": True,
            })

    # Auto-discovery (only if title is provided and no manual sources, or env enables augmenting)
    if anime_title and len(sources) < 3:
        # Check 24h cache
        cache_doc = await db.episode_source_cache.find_one(
            {"mal_id": mal_id, "episode_number": ep_num}, {"_id": 0}
        )
        cached_fresh = False
        if cache_doc:
            cached_at = cache_doc.get("cached_at", "")
            try:
                ts = datetime.fromisoformat(cached_at)
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
                if (datetime.now(timezone.utc) - ts).total_seconds() < 86400:
                    cached_fresh = True
                    for s in cache_doc.get("sources", []):
                        if s["youtube_video_id"] not in seen:
                            seen.add(s["youtube_video_id"])
                            sources.append({**s, "manual": False})
            except Exception:
                pass

        if not cached_fresh:
            discovered = await _search_youtube_for_episode(anime_title, ep_num)
            for d in discovered:
                if d["youtube_video_id"] not in seen:
                    seen.add(d["youtube_video_id"])
                    sources.append({
                        "id": None,
                        "youtube_video_id": d["youtube_video_id"],
                        "channel_name": d["channel_name"],
                        "quality_label": "Auto",
                        "title": d.get("title"),
                        "thumbnail": d.get("thumbnail"),
                        "manual": False,
                    })
            # Cache (even if empty) to avoid hammering quota
            await db.episode_source_cache.update_one(
                {"mal_id": mal_id, "episode_number": ep_num},
                {"$set": {
                    "mal_id": mal_id,
                    "episode_number": ep_num,
                    "sources": [
                        {"youtube_video_id": s["youtube_video_id"], "channel_name": s["channel_name"], "quality_label": s.get("quality_label", "Auto"), "title": s.get("title"), "thumbnail": s.get("thumbnail")}
                        for s in sources if not s.get("manual")
                    ],
                    "cached_at": datetime.now(timezone.utc).isoformat(),
                }},
                upsert=True,
            )

    return {"data": sources, "youtube_api_configured": bool(os.environ.get("YOUTUBE_API_KEY", "").strip())}


@api_router.post("/admin/episode-sources")
async def add_episode_source(payload: EpisodeSourceCreate, request: Request):
    user = await require_admin(request)
    vid = payload.youtube_video_id.strip()
    # Extract video ID from URL if user pasted full URL
    if "youtube.com" in vid or "youtu.be" in vid:
        import re
        m = re.search(r"(?:v=|youtu\.be/|embed/)([A-Za-z0-9_-]{11})", vid)
        if m:
            vid = m.group(1)
    if not vid or len(vid) != 11:
        raise HTTPException(status_code=400, detail="Invalid YouTube video ID")
    source_id = uuid.uuid4().hex
    doc = {
        "source_id": source_id,
        "mal_id": payload.mal_id,
        "episode_number": payload.episode_number,
        "youtube_video_id": vid,
        "channel_name": payload.channel_name or "Manual",
        "quality_label": payload.quality_label or "Auto",
        "title": payload.title,
        "created_by": user.user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.episode_sources.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api_router.delete("/admin/episode-sources/{source_id}")
async def delete_episode_source(source_id: str, request: Request):
    await require_admin(request)
    res = await db.episode_sources.delete_one({"source_id": source_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Source not found")
    return {"ok": True}


@api_router.get("/admin/episode-sources/{mal_id}")
async def list_episode_sources_for_anime(mal_id: int, request: Request):
    await require_admin(request)
    items = await db.episode_sources.find({"mal_id": mal_id}, {"_id": 0}).sort("episode_number", 1).to_list(1000)
    return {"data": items}


@api_router.post("/admin/episode-sources/{mal_id}/auto-scan")
async def auto_scan_anime(mal_id: int, max_episodes: int = 12, request: Request = None):
    """Bulk scan first N episodes of an anime against YouTube; cache results."""
    await require_admin(request)
    api_key = os.environ.get("YOUTUBE_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="YOUTUBE_API_KEY not configured on backend")
    try:
        detail = await cached_jikan_get(f"/anime/{mal_id}", ttl=900)
        title = (detail.get("data") or {}).get("title")
    except Exception:
        title = None
    if not title:
        raise HTTPException(status_code=404, detail="Could not resolve anime title")

    scanned = []
    for ep in range(1, max_episodes + 1):
        discovered = await _search_youtube_for_episode(title, ep)
        if discovered:
            await db.episode_source_cache.update_one(
                {"mal_id": mal_id, "episode_number": ep},
                {"$set": {
                    "mal_id": mal_id, "episode_number": ep,
                    "sources": [{"youtube_video_id": d["youtube_video_id"], "channel_name": d["channel_name"], "quality_label": "Auto", "title": d.get("title"), "thumbnail": d.get("thumbnail")} for d in discovered],
                    "cached_at": datetime.now(timezone.utc).isoformat(),
                }},
                upsert=True,
            )
        scanned.append({"episode": ep, "matches": len(discovered)})
        await asyncio.sleep(0.2)

    return {"anime_title": title, "scanned": scanned, "with_matches": sum(1 for s in scanned if s["matches"] > 0)}


# ---------- Watch Progress ----------
class ProgressToggle(BaseModel):
    episode_number: int
    watched: bool
    title: Optional[str] = None
    image: Optional[str] = None
    total_episodes: Optional[int] = None


@api_router.get("/me/progress/{mal_id}")
async def get_progress(mal_id: int, request: Request):
    user = await require_user(request)
    doc = await db.user_progress.find_one({"user_id": user.user_id, "mal_id": mal_id}, {"_id": 0})
    if not doc:
        return {"mal_id": mal_id, "episodes_watched": [], "last_episode": 0}
    return doc


@api_router.post("/me/progress/{mal_id}")
async def toggle_progress(mal_id: int, payload: ProgressToggle, request: Request):
    user = await require_user(request)
    existing = await db.user_progress.find_one({"user_id": user.user_id, "mal_id": mal_id}, {"_id": 0})
    watched_list = set((existing or {}).get("episodes_watched", []))
    if payload.watched:
        watched_list.add(payload.episode_number)
    else:
        watched_list.discard(payload.episode_number)
    last_episode = max(watched_list) if watched_list else 0
    doc = {
        "user_id": user.user_id,
        "mal_id": mal_id,
        "title": payload.title or (existing or {}).get("title"),
        "image": payload.image or (existing or {}).get("image"),
        "total_episodes": payload.total_episodes or (existing or {}).get("total_episodes"),
        "episodes_watched": sorted(watched_list),
        "last_episode": last_episode,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.user_progress.update_one(
        {"user_id": user.user_id, "mal_id": mal_id},
        {"$set": doc},
        upsert=True,
    )
    return doc


@api_router.get("/me/continue-watching")
async def continue_watching(request: Request):
    user = await require_user(request)
    items = await db.user_progress.find(
        {"user_id": user.user_id, "last_episode": {"$gt": 0}},
        {"_id": 0},
    ).sort("updated_at", -1).limit(20).to_list(20)
    return {"data": items}


# ---------- Comments ----------
@api_router.get("/anime/{mal_id}/comments")
async def list_comments(mal_id: int):
    items = await db.comments.find({"mal_id": mal_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    # average rating
    ratings = await db.ratings.find({"mal_id": mal_id}, {"_id": 0}).to_list(1000)
    avg = round(sum(r["score"] for r in ratings) / len(ratings), 2) if ratings else None
    return {"data": items, "average_rating": avg, "ratings_count": len(ratings)}

@api_router.post("/anime/{mal_id}/comments")
async def add_comment(mal_id: int, payload: CommentCreate, request: Request):
    user = await require_user(request)
    doc = {
        "comment_id": uuid.uuid4().hex,
        "mal_id": mal_id,
        "user_id": user.user_id,
        "user_name": user.name,
        "user_picture": user.picture,
        "text": payload.text,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.comments.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

@api_router.delete("/anime/{mal_id}/comments/{comment_id}")
async def delete_comment(mal_id: int, comment_id: str, request: Request):
    user = await require_user(request)
    res = await db.comments.delete_one({"comment_id": comment_id, "user_id": user.user_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Comment not found")
    return {"ok": True}


# ---------- Ratings ----------
@api_router.post("/anime/{mal_id}/rate")
async def rate_anime(mal_id: int, payload: RatingCreate, request: Request):
    user = await require_user(request)
    if payload.score < 1 or payload.score > 5:
        raise HTTPException(status_code=400, detail="Score must be 1-5")
    await db.ratings.update_one(
        {"user_id": user.user_id, "mal_id": mal_id},
        {"$set": {"score": payload.score, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    ratings = await db.ratings.find({"mal_id": mal_id}, {"_id": 0}).to_list(1000)
    avg = round(sum(r["score"] for r in ratings) / len(ratings), 2) if ratings else None
    return {"average_rating": avg, "ratings_count": len(ratings), "user_score": payload.score}

@api_router.get("/anime/{mal_id}/my-rating")
async def my_rating(mal_id: int, request: Request):
    user = await get_current_user_from_request(request)
    if not user:
        return {"user_score": None}
    r = await db.ratings.find_one({"user_id": user.user_id, "mal_id": mal_id}, {"_id": 0})
    return {"user_score": r["score"] if r else None}


# ---------- Watchlist ----------
@api_router.get("/me/watchlist")
async def get_watchlist(request: Request):
    user = await require_user(request)
    items = await db.watchlist.find({"user_id": user.user_id}, {"_id": 0}).sort("updated_at", -1).to_list(500)
    return {"data": items}

@api_router.post("/me/watchlist")
async def upsert_watchlist(payload: WatchlistCreate, request: Request):
    user = await require_user(request)
    if payload.status not in ("watching", "completed", "plan_to_watch", "dropped"):
        raise HTTPException(status_code=400, detail="Invalid status")
    doc = {
        "user_id": user.user_id,
        "mal_id": payload.mal_id,
        "title": payload.title,
        "image": payload.image,
        "status": payload.status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.watchlist.update_one(
        {"user_id": user.user_id, "mal_id": payload.mal_id},
        {"$set": doc, "$setOnInsert": {"entry_id": uuid.uuid4().hex}},
        upsert=True,
    )
    saved = await db.watchlist.find_one({"user_id": user.user_id, "mal_id": payload.mal_id}, {"_id": 0})
    return saved

@api_router.delete("/me/watchlist/{mal_id}")
async def remove_watchlist(mal_id: int, request: Request):
    user = await require_user(request)
    await db.watchlist.delete_one({"user_id": user.user_id, "mal_id": mal_id})
    return {"ok": True}


# ---------- Favorites ----------
@api_router.get("/me/favorites")
async def get_favorites(request: Request):
    user = await require_user(request)
    items = await db.favorites.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"data": items}

@api_router.post("/me/favorites")
async def add_favorite(payload: FavoriteCreate, request: Request):
    user = await require_user(request)
    doc = {
        "user_id": user.user_id,
        "mal_id": payload.mal_id,
        "title": payload.title,
        "image": payload.image,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.favorites.update_one(
        {"user_id": user.user_id, "mal_id": payload.mal_id},
        {"$set": doc, "$setOnInsert": {"entry_id": uuid.uuid4().hex}},
        upsert=True,
    )
    saved = await db.favorites.find_one({"user_id": user.user_id, "mal_id": payload.mal_id}, {"_id": 0})
    return saved

@api_router.delete("/me/favorites/{mal_id}")
async def remove_favorite(mal_id: int, request: Request):
    user = await require_user(request)
    await db.favorites.delete_one({"user_id": user.user_id, "mal_id": mal_id})
    return {"ok": True}


# ---------- Root ----------
@api_router.get("/")
async def root():
    return {"message": "Nanz.tv Anime Catalog API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
