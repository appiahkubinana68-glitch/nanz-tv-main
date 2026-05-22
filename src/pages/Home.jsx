import React, { useEffect, useState } from "react";
import { api } from "../api";
import AnimeCard from "../components/AnimeCard";

export default function Home() {
  const [animeList, setAnimeList] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get("/anime");
        setAnimeList(res.data);
      } catch (e) {
        console.error("Error loading", e);
      }
    };
    load();
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-center mb-8">Nanz.to — 1000+ Anime</h1>
      
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {animeList.map(anime => (
          <AnimeCard 
            key={anime.mal_id} 
            anime={{
              id: anime.mal_id,
              title: anime.title,
              image: anime.images.jpg.large_image_url
            }} 
          />
        ))}
      </div>
    </div>
  );
}
