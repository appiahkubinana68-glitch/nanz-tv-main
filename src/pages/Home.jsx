import React, { useEffect, useState } from "react";
import { api } from "../api";
import AnimeCard from "../components/AnimeCard";

const Home = () => {
  const [animeList, setAnimeList] = useState([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  // ✅ LOAD 1000s OF ANIME
  const loadAnime = async () => {
    const res = search 
      ? await api.get("/search", { params: { q: search } })
      : await api.get("/anime", { params: { page, limit: 24 } });
    setAnimeList(prev => page === 1 ? res.data : [...prev, ...res.data]);
  };

  useEffect(() => { loadAnime(); }, [page, search]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Nanz.to — 10,000+ Anime</h1>
      
      {/* ✅ SEARCH 1000s OF SHOWS */}
      <input
        type="text"
        placeholder="Search any anime..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        className="w-full p-3 mb-8 rounded bg-gray-800 text-white"
      />

      {/* ✅ GRID OF 1000s */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {animeList.map(anime => (
          <AnimeCard key={anime.id} anime={anime} />
        ))}
      </div>

      {/* ✅ LOAD MORE → GETS NEXT 1000s */}
      {!search && (
        <button 
          onClick={() => setPage(p => p+1)} 
          className="block mx-auto mt-8 bg-blue-600 hover:bg-blue-700 p-3 rounded"
        >
          Load More Anime
        </button>
      )}
    </div>
  );
};

export default Home;
