"""Backend API tests for Anime Catalog (Jikan proxy + auth + custom anime + comments + ratings + watchlist + favorites)."""
import os
import time
import pytest
import requests
import subprocess
import json

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://anime-archive-19.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _sleep():
    # Jikan rate-limit cushion
    time.sleep(0.6)


@pytest.fixture(scope="session")
def auth_token():
    """Create a test user + session directly in mongo and return the bearer token."""
    ts = int(time.time() * 1000)
    token = f"test_session_{ts}"
    uid = f"test-user-{ts}"
    email = f"test.user.{ts}@example.com"
    js = f"""
    use('test_database');
    db.users.insertOne({{user_id: '{uid}', email: '{email}', name: 'Test User',
        picture: 'https://via.placeholder.com/150', created_at: new Date().toISOString()}});
    db.user_sessions.insertOne({{user_id: '{uid}', session_token: '{token}',
        expires_at: new Date(Date.now() + 7*24*60*60*1000), created_at: new Date()}});
    """
    subprocess.run(["mongosh", "--quiet", "--eval", js], check=True, capture_output=True)
    yield {"token": token, "user_id": uid, "email": email}
    # cleanup
    cleanup = f"""
    use('test_database');
    db.users.deleteOne({{user_id: '{uid}'}});
    db.user_sessions.deleteOne({{session_token: '{token}'}});
    db.ratings.deleteMany({{user_id: '{uid}'}});
    db.comments.deleteMany({{user_id: '{uid}'}});
    db.watchlist.deleteMany({{user_id: '{uid}'}});
    db.favorites.deleteMany({{user_id: '{uid}'}});
    db.custom_anime.deleteMany({{created_by: '{uid}'}});
    db.user_progress.deleteMany({{user_id: '{uid}'}});
    """
    subprocess.run(["mongosh", "--quiet", "--eval", cleanup], capture_output=True)


# Admin & non-admin user fixtures for Phase 2
@pytest.fixture(scope="session")
def admin_token():
    """Create an admin user (matching ADMIN_EMAILS) + session."""
    ts = int(time.time() * 1000)
    token = f"test_admin_session_{ts}"
    uid = f"test-admin-{ts}"
    email = "appiahkubinana68@gmail.com"  # must match ADMIN_EMAILS in backend/.env
    js = f"""
    use('test_database');
    db.users.deleteMany({{email: '{email}'}});
    db.user_sessions.deleteMany({{session_token: '{token}'}});
    db.users.insertOne({{user_id: '{uid}', email: '{email}', name: 'Admin User',
        picture: 'https://via.placeholder.com/150', created_at: new Date().toISOString()}});
    db.user_sessions.insertOne({{user_id: '{uid}', session_token: '{token}',
        expires_at: new Date(Date.now() + 7*24*60*60*1000), created_at: new Date()}});
    """
    subprocess.run(["mongosh", "--quiet", "--eval", js], check=True, capture_output=True)
    yield {"token": token, "user_id": uid, "email": email}
    cleanup = f"""
    use('test_database');
    db.users.deleteOne({{user_id: '{uid}'}});
    db.user_sessions.deleteOne({{session_token: '{token}'}});
    db.streaming_overrides.deleteMany({{updated_by: '{uid}'}});
    db.custom_anime.deleteMany({{created_by: '{uid}'}});
    db.user_progress.deleteMany({{user_id: '{uid}'}});
    """
    subprocess.run(["mongosh", "--quiet", "--eval", cleanup], capture_output=True)


@pytest.fixture
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token['token']}"}



@pytest.fixture
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token['token']}"}


# ---------- Public / Jikan proxy ----------
class TestPublic:
    def test_root(self):
        r = requests.get(f"{API}/")
        assert r.status_code == 200
        assert "message" in r.json()

    @pytest.mark.parametrize("path", ["trending", "top", "popular", "season", "upcoming", "genres"])
    def test_anime_lists(self, path):
        _sleep()
        r = requests.get(f"{API}/anime/{path}", timeout=30)
        assert r.status_code == 200, f"{path} failed: {r.text[:200]}"
        body = r.json()
        assert "data" in body
        assert isinstance(body["data"], list)
        if path != "genres":
            assert len(body["data"]) > 0

    def test_browse_search(self):
        _sleep()
        r = requests.get(f"{API}/anime/browse", params={"q": "naruto"}, timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert "data" in body and isinstance(body["data"], list)
        assert len(body["data"]) > 0
        titles = " ".join([a.get("title", "") for a in body["data"]]).lower()
        assert "naruto" in titles

    def test_anime_detail_jikan(self):
        _sleep()
        r = requests.get(f"{API}/anime/20", timeout=30)
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["mal_id"] == 20
        assert "naruto" in data["title"].lower()

    def test_anime_recommendations(self):
        _sleep()
        r = requests.get(f"{API}/anime/20/recommendations", timeout=30)
        assert r.status_code == 200
        assert "data" in r.json()

    def test_comments_public_empty(self):
        # use random high mal_id to ensure empty
        mid = 99999991
        r = requests.get(f"{API}/anime/{mid}/comments")
        assert r.status_code == 200
        body = r.json()
        assert body["data"] == []
        assert body["average_rating"] is None
        assert body["ratings_count"] == 0


# ---------- Auth required ----------
class TestAuthGating:
    def test_me_no_cookie(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_session_invalid(self):
        r = requests.post(f"{API}/auth/session", headers={"X-Session-ID": "invalid_id_xyz"})
        assert r.status_code == 401

    @pytest.mark.parametrize("method,path,body", [
        ("POST", "/anime/20/comments", {"text": "hi"}),
        ("POST", "/anime/20/rate", {"mal_id": 20, "score": 4}),
        ("GET", "/me/watchlist", None),
        ("POST", "/me/watchlist", {"mal_id": 20, "title": "x", "status": "watching"}),
        ("GET", "/me/favorites", None),
        ("POST", "/me/favorites", {"mal_id": 20, "title": "x"}),
        ("POST", "/anime/custom", {"title": "x", "synopsis": "y", "image_url": "z"}),
    ])
    def test_protected_requires_auth(self, method, path, body):
        r = requests.request(method, f"{API}{path}", json=body)
        assert r.status_code == 401, f"{method} {path} expected 401 got {r.status_code}"


# ---------- Authenticated flows ----------
class TestAuthMe:
    def test_me_with_bearer(self, auth_headers, auth_token):
        r = requests.get(f"{API}/auth/me", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["user_id"] == auth_token["user_id"]
        assert body["email"] == auth_token["email"]


class TestRatings:
    MID = 20

    def test_rate_and_get(self, auth_headers):
        r = requests.post(f"{API}/anime/{self.MID}/rate", json={"mal_id": self.MID, "score": 4}, headers=auth_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["user_score"] == 4
        assert body["average_rating"] is not None
        assert body["ratings_count"] >= 1

        r2 = requests.get(f"{API}/anime/{self.MID}/my-rating", headers=auth_headers)
        assert r2.status_code == 200
        assert r2.json()["user_score"] == 4

    def test_rate_invalid_score(self, auth_headers):
        r = requests.post(f"{API}/anime/{self.MID}/rate", json={"mal_id": self.MID, "score": 10}, headers=auth_headers)
        assert r.status_code == 400


class TestComments:
    MID = 20

    def test_comment_create_list_delete(self, auth_headers):
        r = requests.post(f"{API}/anime/{self.MID}/comments", json={"text": "TEST_great anime"}, headers=auth_headers)
        assert r.status_code == 200, r.text
        cid = r.json()["comment_id"]
        assert r.json()["text"] == "TEST_great anime"

        r2 = requests.get(f"{API}/anime/{self.MID}/comments")
        assert r2.status_code == 200
        assert any(c["comment_id"] == cid for c in r2.json()["data"])

        r3 = requests.delete(f"{API}/anime/{self.MID}/comments/{cid}", headers=auth_headers)
        assert r3.status_code == 200

        r4 = requests.get(f"{API}/anime/{self.MID}/comments")
        assert not any(c["comment_id"] == cid for c in r4.json()["data"])


class TestWatchlist:
    MID = 21

    def test_watchlist_crud(self, auth_headers):
        r = requests.post(f"{API}/me/watchlist", json={"mal_id": self.MID, "title": "TEST_One Piece", "status": "watching"}, headers=auth_headers)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "watching"

        r2 = requests.get(f"{API}/me/watchlist", headers=auth_headers)
        assert r2.status_code == 200
        assert any(it["mal_id"] == self.MID for it in r2.json()["data"])

        r3 = requests.delete(f"{API}/me/watchlist/{self.MID}", headers=auth_headers)
        assert r3.status_code == 200

        r4 = requests.get(f"{API}/me/watchlist", headers=auth_headers)
        assert not any(it["mal_id"] == self.MID for it in r4.json()["data"])

    def test_watchlist_invalid_status(self, auth_headers):
        r = requests.post(f"{API}/me/watchlist", json={"mal_id": 22, "title": "x", "status": "bogus"}, headers=auth_headers)
        assert r.status_code == 400


class TestFavorites:
    MID = 30

    def test_favorites_crud(self, auth_headers):
        r = requests.post(f"{API}/me/favorites", json={"mal_id": self.MID, "title": "TEST_Bleach"}, headers=auth_headers)
        assert r.status_code == 200, r.text

        r2 = requests.get(f"{API}/me/favorites", headers=auth_headers)
        assert r2.status_code == 200
        assert any(it["mal_id"] == self.MID for it in r2.json()["data"])

        r3 = requests.delete(f"{API}/me/favorites/{self.MID}", headers=auth_headers)
        assert r3.status_code == 200

        r4 = requests.get(f"{API}/me/favorites", headers=auth_headers)
        assert not any(it["mal_id"] == self.MID for it in r4.json()["data"])


class TestCustomAnime:
    def test_create_list_detail(self, admin_headers):
        auth_headers = admin_headers  # custom anime is admin-only in Phase 2
        payload = {
            "title": "TEST_Custom Anime",
            "synopsis": "A test synopsis",
            "image_url": "https://example.com/a.jpg",
            "year": 2026,
            "type": "TV",
            "status": "Finished Airing",
            "episodes": 12,
            "genres": ["Action", "Adventure"],
            "trailer_youtube_id": "dQw4w9WgXcQ",
        }
        r = requests.post(f"{API}/anime/custom", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["title"] == payload["title"]
        assert created["mal_id"] < 0
        neg_id = created["mal_id"]

        r2 = requests.get(f"{API}/anime/custom")
        assert r2.status_code == 200
        assert any(it["mal_id"] == neg_id for it in r2.json()["data"])

        r3 = requests.get(f"{API}/anime/{neg_id}")
        assert r3.status_code == 200
        d = r3.json()["data"]
        assert d["mal_id"] == neg_id
        assert d["title"] == payload["title"]
        assert d.get("is_custom") is True
        assert d["trailer"]["youtube_id"] == "dQw4w9WgXcQ"

        # recommendations for custom returns empty
        r4 = requests.get(f"{API}/anime/{neg_id}/recommendations")
        assert r4.status_code == 200
        assert r4.json()["data"] == []


# ====================== Phase 2 Tests ======================

class TestIsAdmin:
    def test_is_admin_no_auth(self):
        r = requests.get(f"{API}/auth/is-admin")
        assert r.status_code == 200
        assert r.json() == {"is_admin": False}

    def test_is_admin_non_admin(self, auth_headers):
        r = requests.get(f"{API}/auth/is-admin", headers=auth_headers)
        assert r.status_code == 200
        assert r.json() == {"is_admin": False}

    def test_is_admin_admin(self, admin_headers):
        r = requests.get(f"{API}/auth/is-admin", headers=admin_headers)
        assert r.status_code == 200
        assert r.json() == {"is_admin": True}


class TestStreamingAllowed:
    def test_allowed_returns_seven(self):
        r = requests.get(f"{API}/streaming/allowed")
        assert r.status_code == 200
        data = r.json()["data"]
        assert isinstance(data, list)
        assert len(data) == 7
        expected = {"Crunchyroll", "Netflix", "Amazon Prime Video", "Hulu", "Tubi", "Pluto TV", "RetroCrush"}
        assert set(data) == expected


class TestEpisodes:
    def test_naruto_episodes_page1(self):
        _sleep()
        r = requests.get(f"{API}/anime/20/episodes", params={"page": 1}, timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert "data" in body and isinstance(body["data"], list)
        # Naruto (20) page 1 should be 100 entries
        assert len(body["data"]) == 100
        pg = body.get("pagination", {})
        assert pg.get("has_next_page") is True

    def test_naruto_episodes_page2(self):
        _sleep()
        r = requests.get(f"{API}/anime/20/episodes", params={"page": 2}, timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body["data"], list)
        # Page 2 should also have items (Naruto has 220 eps)
        assert len(body["data"]) > 0


class TestStreaming:
    def test_one_piece_streaming(self):
        _sleep()
        r = requests.get(f"{API}/anime/21/streaming", timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert "data" in body and isinstance(body["data"], list)
        assert body.get("source") in ("anilist", "merged")
        allowed = {"Crunchyroll", "Netflix", "Amazon Prime Video", "Hulu", "Tubi", "Pluto TV", "RetroCrush"}
        for item in body["data"]:
            assert item["site"] in allowed, f"Non-whitelisted site: {item['site']}"
            assert item["url"].startswith("http")


class TestAdminGatingCustomAnime:
    def test_custom_no_auth_returns_401(self):
        r = requests.post(f"{API}/anime/custom", json={"title": "x", "synopsis": "y", "image_url": "z"})
        assert r.status_code == 401

    def test_custom_non_admin_returns_403(self, auth_headers):
        r = requests.post(
            f"{API}/anime/custom",
            json={"title": "TEST_NA", "synopsis": "y", "image_url": "https://x.com/a.jpg"},
            headers=auth_headers,
        )
        assert r.status_code == 403, r.text

    def test_custom_admin_creates(self, admin_headers):
        r = requests.post(
            f"{API}/anime/custom",
            json={"title": "TEST_AdminCustom", "synopsis": "Made by admin", "image_url": "https://x.com/a.jpg",
                  "year": 2026, "type": "TV", "status": "Finished Airing", "episodes": 6, "genres": ["Drama"]},
            headers=admin_headers,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["title"] == "TEST_AdminCustom"
        assert body["mal_id"] < 0


class TestStreamingOverrides:
    MID = 21  # One Piece

    def test_override_no_auth_401(self):
        r = requests.post(f"{API}/anime/{self.MID}/streaming-overrides",
                          json={"links": [{"site": "Tubi", "url": "https://tubitv.com/series/xyz"}]})
        assert r.status_code == 401

    def test_override_non_admin_403(self, auth_headers):
        r = requests.post(f"{API}/anime/{self.MID}/streaming-overrides",
                          json={"links": [{"site": "Tubi", "url": "https://tubitv.com/series/xyz"}]},
                          headers=auth_headers)
        assert r.status_code == 403

    def test_override_admin_saves_and_merges(self, admin_headers):
        # Save override
        r = requests.post(f"{API}/anime/{self.MID}/streaming-overrides",
                          json={"links": [{"site": "Tubi", "url": "https://tubitv.com/series/xyz"}]},
                          headers=admin_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["mal_id"] == self.MID
        assert any(l["site"] == "Tubi" and l["url"].startswith("http") for l in body["links"])

        # Now GET /anime/{id}/streaming should include Tubi and source 'merged'
        _sleep()
        r2 = requests.get(f"{API}/anime/{self.MID}/streaming", timeout=30)
        assert r2.status_code == 200
        body2 = r2.json()
        assert body2["source"] == "merged"
        sites = [l["site"] for l in body2["data"]]
        assert "Tubi" in sites
        # cleanup override at end
        subprocess.run(["mongosh", "--quiet", "--eval",
                        f"use('test_database'); db.streaming_overrides.deleteOne({{mal_id: {self.MID}}});"],
                       capture_output=True)

    def test_override_rejects_invalid_site_and_url(self, admin_headers):
        r = requests.post(f"{API}/anime/9999991/streaming-overrides",
                          json={"links": [
                              {"site": "Disney+", "url": "https://disneyplus.com/x"},  # not in allowlist
                              {"site": "Tubi", "url": "ftp://bad-scheme"},               # bad scheme
                              {"site": "Netflix", "url": "https://netflix.com/title/1"}, # valid
                          ]},
                          headers=admin_headers)
        assert r.status_code == 200, r.text
        links = r.json()["links"]
        sites = [l["site"] for l in links]
        assert "Disney+" not in sites
        assert "Tubi" not in sites  # ftp:// rejected
        assert "Netflix" in sites
        # cleanup
        subprocess.run(["mongosh", "--quiet", "--eval",
                        "use('test_database'); db.streaming_overrides.deleteOne({mal_id: 9999991});"],
                       capture_output=True)


class TestWatchProgress:
    MID = 1535  # Death Note - high episode count not required

    def test_progress_requires_auth(self):
        r = requests.get(f"{API}/me/progress/{self.MID}")
        assert r.status_code == 401

    def test_continue_watching_requires_auth(self):
        r = requests.get(f"{API}/me/continue-watching")
        assert r.status_code == 401

    def test_progress_empty_for_new_anime(self, auth_headers, auth_token):
        # Ensure clean state
        subprocess.run(["mongosh", "--quiet", "--eval",
                        f"use('test_database'); db.user_progress.deleteMany({{user_id: '{auth_token['user_id']}'}});"],
                       capture_output=True)
        r = requests.get(f"{API}/me/progress/{self.MID}", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["episodes_watched"] == []
        assert body["last_episode"] == 0

    def test_progress_toggle_flow(self, auth_headers):
        # Mark ep 1 watched
        r = requests.post(f"{API}/me/progress/{self.MID}",
                          json={"episode_number": 1, "watched": True, "title": "Test",
                                "image": "http://x", "total_episodes": 12},
                          headers=auth_headers)
        assert r.status_code == 200, r.text
        assert r.json()["episodes_watched"] == [1]
        assert r.json()["last_episode"] == 1

        # Mark ep 2 watched
        r2 = requests.post(f"{API}/me/progress/{self.MID}",
                           json={"episode_number": 2, "watched": True},
                           headers=auth_headers)
        assert r2.status_code == 200
        assert r2.json()["episodes_watched"] == [1, 2]
        assert r2.json()["last_episode"] == 2

        # Unmark ep 2
        r3 = requests.post(f"{API}/me/progress/{self.MID}",
                           json={"episode_number": 2, "watched": False},
                           headers=auth_headers)
        assert r3.status_code == 200
        assert r3.json()["episodes_watched"] == [1]
        assert r3.json()["last_episode"] == 1

        # GET reflects state
        r4 = requests.get(f"{API}/me/progress/{self.MID}", headers=auth_headers)
        assert r4.status_code == 200
        assert r4.json()["episodes_watched"] == [1]
        assert r4.json()["last_episode"] == 1

    def test_continue_watching_returns_items(self, auth_headers):
        # Add a second anime in progress
        requests.post(f"{API}/me/progress/9999",
                      json={"episode_number": 3, "watched": True, "title": "AAA",
                            "image": "http://x", "total_episodes": 24},
                      headers=auth_headers)
        time.sleep(0.2)
        # Then update first one so it's most recent
        requests.post(f"{API}/me/progress/{self.MID}",
                      json={"episode_number": 1, "watched": True},
                      headers=auth_headers)
        r = requests.get(f"{API}/me/continue-watching", headers=auth_headers)
        assert r.status_code == 200
        items = r.json()["data"]
        assert len(items) >= 2
        # Most recent first
        assert items[0]["mal_id"] == self.MID
        # All items have last_episode > 0
        assert all(it["last_episode"] > 0 for it in items)


# ====================== Phase 3 Tests: Licensed YouTube Episode Sources ======================

EXPECTED_CHANNELS = {
    "Muse Asia", "Ani-One Asia", "Crunchyroll Collection",
    "GKIDS Films", "RetroCrush", "Ani-One Asia Classic", "Ani-One Italia",
}


@pytest.fixture(scope="session", autouse=True)
def _cleanup_phase3():
    yield
    # Clean up Phase 3 collections
    cleanup = """
    use('test_database');
    db.episode_sources.deleteMany({channel_name: /^TEST_|^Muse Asia$|^Manual$/});
    db.episode_source_cache.deleteMany({mal_id: {$in: [20, 21, 9999991]}});
    """
    subprocess.run(["mongosh", "--quiet", "--eval", cleanup], capture_output=True)


class TestYouTubeChannels:
    def test_list_licensed_channels(self):
        r = requests.get(f"{API}/youtube/channels")
        assert r.status_code == 200
        body = r.json()
        assert "data" in body
        data = body["data"]
        assert isinstance(data, list)
        assert len(data) == 7
        names = {c["name"] for c in data}
        assert names == EXPECTED_CHANNELS
        for c in data:
            assert "id" in c and "name" in c
            assert isinstance(c["id"], str) and c["id"].startswith("UC")


class TestEpisodeSourcesPublic:
    MID = 20  # Naruto

    def test_get_sources_without_api_key_no_manuals(self):
        # ep 999 unlikely to have manual sources
        r = requests.get(
            f"{API}/anime/{self.MID}/episodes/999/sources",
            params={"anime_title": "Naruto"},
        )
        assert r.status_code == 200
        body = r.json()
        assert "data" in body
        assert isinstance(body["data"], list)
        assert body["youtube_api_configured"] is False

    def test_get_sources_no_title_no_key_returns_empty(self):
        r = requests.get(f"{API}/anime/{self.MID}/episodes/998/sources")
        assert r.status_code == 200
        body = r.json()
        assert body["data"] == []
        assert body["youtube_api_configured"] is False


class TestAdminEpisodeSources:
    MID = 20
    EP = 1
    VALID_VID = "dQw4w9WgXcQ"

    def _cleanup_anime(self):
        subprocess.run(
            ["mongosh", "--quiet", "--eval",
             f"use('test_database'); db.episode_sources.deleteMany({{mal_id: {self.MID}}});"],
            capture_output=True,
        )

    def test_add_source_no_auth_401(self):
        r = requests.post(f"{API}/admin/episode-sources",
                          json={"mal_id": self.MID, "episode_number": self.EP,
                                "youtube_video_id": self.VALID_VID, "channel_name": "Muse Asia"})
        assert r.status_code == 401

    def test_add_source_non_admin_403(self, auth_headers):
        r = requests.post(f"{API}/admin/episode-sources",
                          json={"mal_id": self.MID, "episode_number": self.EP,
                                "youtube_video_id": self.VALID_VID, "channel_name": "Muse Asia"},
                          headers=auth_headers)
        assert r.status_code == 403

    def test_add_source_admin_raw_id(self, admin_headers):
        self._cleanup_anime()
        r = requests.post(f"{API}/admin/episode-sources",
                          json={"mal_id": self.MID, "episode_number": self.EP,
                                "youtube_video_id": self.VALID_VID, "channel_name": "Muse Asia"},
                          headers=admin_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "source_id" in body
        assert body["youtube_video_id"] == self.VALID_VID
        assert body["mal_id"] == self.MID
        assert body["episode_number"] == self.EP
        assert body["channel_name"] == "Muse Asia"

        # Verify it appears in public sources endpoint with manual=true
        r2 = requests.get(f"{API}/anime/{self.MID}/episodes/{self.EP}/sources")
        assert r2.status_code == 200
        data = r2.json()["data"]
        match = [s for s in data if s["youtube_video_id"] == self.VALID_VID]
        assert len(match) >= 1
        assert match[0]["manual"] is True
        assert match[0]["channel_name"] == "Muse Asia"

    @pytest.mark.parametrize("url", [
        "https://youtu.be/dQw4w9WgXcQ",
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://www.youtube.com/embed/dQw4w9WgXcQ",
    ])
    def test_add_source_accepts_urls(self, admin_headers, url):
        r = requests.post(f"{API}/admin/episode-sources",
                          json={"mal_id": self.MID, "episode_number": 2,
                                "youtube_video_id": url, "channel_name": "Muse Asia"},
                          headers=admin_headers)
        assert r.status_code == 200, r.text
        assert r.json()["youtube_video_id"] == "dQw4w9WgXcQ"

    @pytest.mark.parametrize("bad", ["short", "waytoolongvalueXYZ", "", "12345"])
    def test_add_source_rejects_invalid_id(self, admin_headers, bad):
        r = requests.post(f"{API}/admin/episode-sources",
                          json={"mal_id": self.MID, "episode_number": 3,
                                "youtube_video_id": bad, "channel_name": "Muse Asia"},
                          headers=admin_headers)
        assert r.status_code == 400, r.text

    def test_list_sources_admin_only(self, admin_headers, auth_headers):
        # No auth
        r0 = requests.get(f"{API}/admin/episode-sources/{self.MID}")
        assert r0.status_code == 401
        # Non-admin
        r1 = requests.get(f"{API}/admin/episode-sources/{self.MID}", headers=auth_headers)
        assert r1.status_code == 403
        # Admin
        # Ensure at least 2 episodes exist
        for ep in (5, 3):
            requests.post(f"{API}/admin/episode-sources",
                          json={"mal_id": self.MID, "episode_number": ep,
                                "youtube_video_id": "dQw4w9WgXcQ", "channel_name": "Muse Asia"},
                          headers=admin_headers)
        r2 = requests.get(f"{API}/admin/episode-sources/{self.MID}", headers=admin_headers)
        assert r2.status_code == 200
        items = r2.json()["data"]
        assert isinstance(items, list)
        assert len(items) >= 2
        eps = [it["episode_number"] for it in items]
        assert eps == sorted(eps), f"Not sorted asc: {eps}"
        # No mongodb _id leaks
        for it in items:
            assert "_id" not in it

    def test_delete_source(self, admin_headers, auth_headers):
        # Create a fresh source first
        r = requests.post(f"{API}/admin/episode-sources",
                          json={"mal_id": self.MID, "episode_number": 99,
                                "youtube_video_id": "dQw4w9WgXcQ", "channel_name": "Muse Asia"},
                          headers=admin_headers)
        assert r.status_code == 200
        sid = r.json()["source_id"]

        # No auth → 401
        r0 = requests.delete(f"{API}/admin/episode-sources/{sid}")
        assert r0.status_code == 401
        # Non-admin → 403
        r1 = requests.delete(f"{API}/admin/episode-sources/{sid}", headers=auth_headers)
        assert r1.status_code == 403
        # Admin → 200 OK
        r2 = requests.delete(f"{API}/admin/episode-sources/{sid}", headers=admin_headers)
        assert r2.status_code == 200
        assert r2.json().get("ok") is True
        # Again → 404
        r3 = requests.delete(f"{API}/admin/episode-sources/{sid}", headers=admin_headers)
        assert r3.status_code == 404

    def test_auto_scan_without_api_key_returns_400(self, admin_headers, auth_headers):
        # No auth → 401
        r0 = requests.post(f"{API}/admin/episode-sources/{self.MID}/auto-scan", params={"max_episodes": 12})
        assert r0.status_code == 401
        # Non-admin → 403
        r1 = requests.post(f"{API}/admin/episode-sources/{self.MID}/auto-scan",
                           params={"max_episodes": 12}, headers=auth_headers)
        assert r1.status_code == 403
        # Admin, but YOUTUBE_API_KEY is blank → 400 with mention of the key
        r2 = requests.post(f"{API}/admin/episode-sources/{self.MID}/auto-scan",
                           params={"max_episodes": 12}, headers=admin_headers)
        assert r2.status_code == 400, r2.text
        detail = r2.json().get("detail", "")
        assert "YOUTUBE_API_KEY" in detail

