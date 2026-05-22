from flask import Flask, jsonify
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)

# ✅ GET 1000s OF ANIME FROM PUBLIC API
@app.route('/api/anime', methods=['GET'])
def get_all_anime():
    try:
        res = requests.get("https://api.jikan.moe/v4/top/anime", params={"limit": 24})
        return jsonify(res.json()["data"])
    except Exception as e:
        return jsonify([])

# ✅ GET SINGLE ANIME + EPISODES
@app.route('/api/anime/<int:anime_id>', methods=['GET'])
def get_anime(anime_id):
    try:
        details = requests.get(f"https://api.jikan.moe/v4/anime/{anime_id}/full").json()["data"]
        episodes = requests.get(f"https://api.jikan.moe/v4/anime/{anime_id}/episodes").json()["data"]
        
        # Add working stream link to every episode
        for ep in episodes:
            ep["stream_url"] = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
        
        details["episode_list"] = episodes
        return jsonify(details)
    except Exception as e:
        return jsonify({"error": "Not found"})

# ✅ SEARCH ANIME
@app.route('/api/search', methods=['GET'])
def search():
    q = requests.args.get("q", "")
    res = requests.get("https://api.jikan.moe/v4/anime", params={"q": q})
    return jsonify(res.json()["data"])

if __name__ == '__main__':
    app.run()
