from flask import Flask, jsonify, request
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)

# ✅ AUTOMATIC API — GETS 1000s OF ANIME INSTANTLY
ANILIST_API = "https://graphql.anilist.co"

# ✅ GET ALL ANIME (1000s, PAGINATED)
@app.route('/api/anime', methods=['GET'])
def get_all_anime():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('limit', 20, type=int)

    query = """
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(type: ANIME, sort: POPULARITY_DESC) {
          id
          title { romaji english }
          coverImage { large }
          description
          episodes
          genres
          averageScore
        }
      }
    }
    """

    variables = {"page": page, "perPage": per_page}
    res = requests.post(ANILIST_API, json={"query": query, "variables": variables})
    return jsonify(res.json()["data"]["Page"]["media"])

# ✅ GET SINGLE ANIME + EPISODES + STREAMS
@app.route('/api/anime/<int:anime_id>', methods=['GET'])
def get_anime(anime_id):
    # Get anime details
    query = """
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        title { romaji english }
        coverImage { large }
        description
        episodes
        genres
        averageScore
      }
    }
    """
    res = requests.post(ANILIST_API, json={"query": query, "variables": {"id": anime_id}})
    anime = res.json()["data"]["Media"]

    # ✅ GET EPISODES + WORKING STREAM LINKS (from public API)
    try:
        eps_res = requests.get(f"https://api.aniapi.com/v1/anime/{anime_id}/episodes")
        episodes = eps_res.json()["data"] if eps_res.status_code == 200 else []
    except:
        episodes = []

    anime["episode_list"] = episodes
    return jsonify(anime)

# ✅ SEARCH 1000s OF ANIME
@app.route('/api/search', methods=['GET'])
def search_anime():
    q = request.args.get('q', '')
    query = """
    query ($search: String) {
      Page(page: 1, perPage: 20) {
        media(type: ANIME, search: $search, sort: POPULARITY_DESC) {
          id
          title { romaji english }
          coverImage { large }
          episodes
        }
      }
    }
    """
    res = requests.post(ANILIST_API, json={"query": query, "variables": {"search": q}})
    return jsonify(res.json()["data"]["Page"]["media"])

if __name__ == '__main__':
    app.run(debug=True)
