import React, { useEffect, useState } from "react";
import { api } from "../api";
import AnimeCard from "../components/AnimeCard";

export default function Home() {
  const [animeList, setAnimeList] = useState([]);

  useEffect(() => {
    const loadAnime = async () => {
      try {
        // Call API safely
        const res = await api.get("/anime");
        // ✅ Force it to be an array, even if API fails
        if (Array.isArray(res.data)) {
          setAnimeList(res.data);
        } else {
          setAnimeList([]);
        }
      } catch (err) {
        console.error("Load error:", err);
        setAnimeList([]); // Fallback: empty list
      }
    };
    loadAnime();
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-center mb-8 text-white">Nanz.to — Anime</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {animeList.length > 0 ? (
          animeList.map((anime) => (
            <AnimeCard
              key={anime.mal_id || anime.id}
              anime={{
                id: anime.mal_id || anime.id,
                title: anime.title || anime.name,
                image: anime.images?.jpg?.large_image_url || "https://via.placeholder.com/300x450?text=Anime",
              }}
            />
          ))
        ) : (
          <p className="text-white col-span-full text-center">Loading anime...</p>
        )}
      </div>
    </div>
  );
}
