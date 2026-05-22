from flask import Flask, jsonify, request
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)

JIKAN_API = "https://api.jikan.moe/v4"

@app.route('/api/anime', methods=['GET'])
def get_all_anime():
    try:
        res = requests.get(f"{JIKAN_API}/top/anime", params={"limit":24}, timeout=10)
        return jsonify(res.json().get("data", []))
    except:
        return jsonify([])

@app.route('/api/search', methods=['GET'])
def search_anime():
    q = request.args.get('q','')
    try:
        res = requests.get(f"{JIKAN_API}/anime", params={"q":q,"limit":24}, timeout=10)
        return jsonify(res.json().get("data", []))
    except:
        return jsonify([])

@app.route('/api/anime/<int:anime_id>', methods=['GET'])
def get_anime_details(anime_id):
    return jsonify({"title":"Anime","episode_list":[]})

if __name__ == '__main__':
    app.run()
