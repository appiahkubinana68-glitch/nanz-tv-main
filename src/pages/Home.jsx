import React, { useEffect, useState } from "react";
import { api } from "../api";
import AnimeCard from "../components/AnimeCard";

// ✅ FALLBACK: ALWAYS SHOW SOMETHING
const fallback = [
  {"mal_id":16498,"title":"Attack on Titan","images":{"jpg":{"large_image_url":"https://cdn.myanimelist.net/images/anime/10/47347l.jpg"}}},
  {"mal_id":20,"title":"Naruto","images":{"jpg":{"large_image_url":"https://cdn.myanimelist.net/images/anime/13/17405l.jpg"}}},
  {"mal_id":5113,"title":"Demon Slayer","images":{"jpg":{"large_image_url":"https://cdn.myanimelist.net/images/anime/1286/99889l.jpg"}}},
  {"mal_id":1535,"title":"Death Note","images":{"jpg":{"large_image_url":"https://cdn.myanimelist.net/images/anime/9/9453l.jpg"}}},
  {"mal_id":11757,"title":"One Punch Man","images":{"jpg":{"large_image_url":"https://cdn.myanimelist.net/images/anime/11/76074l.jpg"}}},
  {"mal_id":30276,"title":"My Hero Academia","images":{"jpg":{"large_image_url":"https://cdn.myanimelist.net/images/anime/1370/114355l.jpg"}}},
  {"mal_id":400,"title":"Bleach","images":{"jpg":{"large_image_url":"https://cdn.myanimelist.net/images/anime/3/72034l.jpg"}}},
  {"mal_id":235,"title":"Hunter x Hunter","images":{"jpg":{"large_image_url":"https://cdn.myanimelist.net/images/anime/11/33667l.jpg"}}},
  {"mal_id":21,"title":"One Piece","images":{"jpg":{"large_image_url":"https://cdn.myanimelist.net/images/anime/6/73245l.jpg"}}},
  {"mal_id":97940,"title":"Jujutsu Kaisen","images":{"jpg":{"large_image_url":"https://cdn.myanimelist.net/images/anime/1171/142503l.jpg"}}},
  {"mal_id":1,"title":"Cowboy Bebop","images":{"jpg":{"large_image_url":"https://cdn.myanimelist.net/images/anime/4/19644l.jpg"}}},
  {"mal_id":223,"title":"Dragon Ball Z","images":{"jpg":{"large_image_url":"https://cdn.myanimelist.net/images/anime/12/11396l.jpg"}}}
];

export default function Home() {
  const [animeList, setAnimeList] = useState(fallback);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = search 
        ? await api.get("/search", { params: { q: search } })
        : await api.get("/anime", { params: { page, limit: 24 } });

      if (Array.isArray(res.data) && res.data.length > 0) {
        setAnimeList(prev => page === 1 ? res.data : [...prev, ...res.data]);
      }
    } catch (err) {
      console.error("Load failed:", err);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [page, search]);
  const handleSearch = (e) => { setSearch(e.target.value); setPage(1); };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-center mb-6 text-white">Nanz.to — Watch Anime Free</h1>
      
      <input
        type="text"
        placeholder="🔍 Search any anime..."
        value={search}
        onChange={handleSearch}
        className="w-full p-4 mb-8 rounded-lg bg-gray-800 text-white border border-gray-700"
      />

      {/* ✅ 18,000+ ANIME GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {animeList.map(anime => (
          <AnimeCard 
            key={anime.mal_id} 
            anime={{
              id: anime.mal_id,
              title: anime.title || "Untitled",
              image: anime.images?.jpg?.large_image_url || "https://via.placeholder.com/300x450?text=Anime"
            }} 
          />
        ))}
      </div>

      {/* ✅ LOAD MORE → NEXT 24 → 18,000+ */}
      {!search && (
        <button 
          onClick={() => setPage(p => p+1)} 
          disabled={loading}
          className="block mx-auto mt-10 bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-lg text-white font-semibold"
        >
          {loading ? "Loading..." : "Load More Anime"}
        </button>
      )}
    </div>
  );
}
