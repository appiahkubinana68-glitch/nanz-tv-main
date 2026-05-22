from flask import Flask, jsonify, request
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)

JIKAN_API = "https://api.jikan.moe/v4"
STREAM_API = "https://api.consumet.org/anime/gogoanime"

# ✅ ALWAYS RETURN ARRAY — NO CRASHES
@app.route('/api/anime', methods=['GET'])
def get_all_anime():
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 24, type=int)
    try:
        res = requests.get(f"{JIKAN_API}/top/anime", params={"page": page, "limit": limit}, timeout=15)
        data = res.json()
        return jsonify(data.get("data", []))
    except:
        return jsonify([])  # ✅ Empty array if fails

@app.route('/api/search', methods=['GET'])
def search_anime():
    q = request.args.get('q', '')
    try:
        res = requests.get(f"{JIKAN_API}/anime", params={"q": q, "limit": 24}, timeout=15)
        data = res.json()
        return jsonify(data.get("data", []))
    except:
        return jsonify([])

@app.route('/api/anime/<int:anime_id>', methods=['GET'])
def get_anime_details(anime_id):
    try:
        details = requests.get(f"{JIKAN_API}/anime/{anime_id}/full", timeout=15).json()["data"]
        anime_title = details.get("title", "").replace(" ", "-").lower()

        search = requests.get(f"{STREAM_API}/{anime_title}", params={"limit": 1}, timeout=15).json()
        if not search.get("results"):
            details["episode_list"] = []
            return jsonify(details)

        stream_id = search["results"][0]["id"]
        episodes = requests.get(f"{STREAM_API}/info/{stream_id}", timeout=15).json()
        eps_list = episodes.get("episodes", [])

        for ep in eps_list:
            try:
                stream_data = requests.get(f"{STREAM_API}/watch/{ep['id']}", timeout=15).json()
                links = stream_data.get("sources", [])
                best_link = next((l["url"] for l in links if l["quality"] in ["1080p", "720p"]), None)
                ep["stream_url"] = best_link or "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
            except:
                ep["stream_url"] = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"

        details["episode_list"] = eps_list
        return jsonify(details)
    except:
        return jsonify({"title": "Anime", "episode_list": []})

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000)
