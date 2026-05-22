import React, { useEffect, useState } from "react";
import { api } from "../api";
import AnimeCard from "../components/AnimeCard";

export default function Home() {
  const [animeList, setAnimeList] = useState([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const loadAnime = async () => {
    setLoading(true);
    try {
      const res = search 
        ? await api.get("/search", { params: { q: search } })
        : await api.get("/anime", { params: { page, limit: 24 } });
      
      setAnimeList(prev => page === 1 ? res.data : [...prev, ...res.data]);
    } catch (err) {
      console.error("Load error", err);
    }
    setLoading(false);
  };

  useEffect(() => { loadAnime(); }, [page, search]);
  const handleSearch = (e) => { setSearch(e.target.value); setPage(1); };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-center mb-6 text-white">Nanz.to — Watch Anime Free</h1>
      
      {/* SEARCH BAR */}
      <input
        type="text"
        placeholder="🔍 Search anime, genre, year..."
        value={search}
        onChange={handleSearch}
        className="w-full p-4 mb-8 rounded-lg bg-gray-800 text-white border border-gray-700"
      />

      {/* ANIME GRID — 18,000+ SHOWS */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {animeList.map(anime => (
          <AnimeCard 
            key={anime.mal_id} 
            anime={{
              id: anime.mal_id,
              title: anime.title,
              image: anime.images?.jpg?.large_image_url || "https://via.placeholder.com/300x450?text=Anime"
            }} 
          />
        ))}
      </div>

      {/* LOAD MORE */}
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
