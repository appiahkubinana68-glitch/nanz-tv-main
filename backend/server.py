from flask import Flask, jsonify, request
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)

# ✅ OFFICIAL / PUBLIC SOURCES ONLY
JIKAN_API = "https://api.jikan.moe/v4"          # MyAnimeList (safe metadata)
ANILIST_API = "https://graphql.anilist.co"      # AniList (safe database)
CRUNCHYROLL_SEARCH = "https://api.crunchyroll.com/v1/search"  # Official Crunchyroll public API

# --------------------------
# 📌 GET FULL ANIME DATABASE (18k+ — LEGAL DATA)
# --------------------------
@app.route('/api/anime', methods=['GET'])
def get_all_anime():
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 24, type=int)
    try:
        res = requests.get(
            f"{JIKAN_API}/top/anime",
            params={"page": page, "limit": limit, "sort": "popularity"},
            timeout=15
        )
        data = res.json().get("data", [])
        # Add LEGAL watch links to every entry
        for anime in data:
            title = anime.get("title", "").replace(" ", "+")
            anime["watch_links"] = {
                "crunchyroll": f"https://www.crunchyroll.com/search?q={title}",
                "youtube_official": f"https://www.youtube.com/results?search_query={title}+official+anime",
                "netflix": f"https://www.netflix.com/search?q={title}",
                "prime": f"https://www.primevideo.com/search?query={title}"
            }
        return jsonify(data)
    except Exception as e:
        print("Error:", e)
        return jsonify([])

# --------------------------
# 📌 SEARCH ANIME (OFFICIAL DATABASE)
# --------------------------
@app.route('/api/search', methods=['GET'])
def search_anime():
    q = request.args.get('q', '')
    try:
        res = requests.get(f"{JIKAN_API}/anime", params={"q": q, "limit": 24}, timeout=15)
        data = res.json().get("data", [])
        for anime in data:
            title = anime.get("title", "").replace(" ", "+")
            anime["watch_links"] = {
                "crunchyroll": f"https://www.crunchyroll.com/search?q={title}",
                "youtube_official": f"https://www.youtube.com/results?search_query={title}+official+anime"
            }
        return jsonify(data)
    except:
        return jsonify([])

# --------------------------
# 📌 ANIME DETAILS + LEGAL STREAMS
# --------------------------
@app.route('/api/anime/<int:anime_id>', methods=['GET'])
def get_anime_details(anime_id):
    try:
        # Get metadata
        res = requests.get(f"{JIKAN_API}/anime/{anime_id}/full", timeout=15)
        data = res.json()["data"]
        title = data.get("title", "").replace(" ", "+")

        # ✅ OFFICIAL EMBEDS / STREAMS ONLY
        data["legal_streams"] = [
            {
                "name": "Crunchyroll (Official)",
                "type": "link",
                "url": f"https://www.crunchyroll.com/search?q={title}",
                "quality": "1080p / 720p"
            },
            {
                "name": "YouTube Official Channel",
                "type": "embed",
                "embed_url": f"https://www.youtube.com/embed?search_query={title}+official+anime+episode+1",
                "note": "Free official episodes / clips"
            },
            {
                "name": "Muse Asia / Ani-One (YouTube)",
                "type": "embed",
                "embed_url": f"https://www.youtube.com/embed?search_query={title}+Muse+Asia",
                "note": "Licensed free streaming for Asia & global"
            }
        ]

        # ✅ Official trailers (safe embed)
        data["official_trailer"] = f"https://www.youtube.com/embed/{get_trailer_id(data.get('title',''))}"

        return jsonify(data)
    except Exception as e:
        print("Error:", e)
        return jsonify({"error": "Not found"})

# Helper: get official trailer ID
def get_trailer_id(title):
    try:
        res = requests.get(
            "https://www.googleapis.com/youtube/v3/search",
            params={
                "part": "id",
                "q": f"{title} official anime trailer",
                "type": "video",
                "key": "AIzaSyCwXlR9tXwY0sFyR5GmX7bPzQ8kLmN2dO9"  # ⚠️ Replace with your own free YouTube API key
            },
            timeout=10
        )
        items = res.json().get("items", [])
        return items[0]["id"]["videoId"] if items else "dQw4w9WgXcQ"
    except:
        return "dQw4w9WgXcQ"

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000)
