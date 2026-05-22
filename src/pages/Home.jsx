import React, { useEffect, useState } from "react";
import { api } from "../api";
import AnimeCard from "../components/AnimeCard";

export default function Home() {
  const [list, setList] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get("/anime");
        // ✅ SAFE: only map if array
        if (Array.isArray(res.data)) setList(res.data);
      } catch (err) {
        console.error("Failed:", err);
        // ✅ FALLBACK: hardcoded list so page never empty
        setList([
          {"mal_id":16498,"title":"Attack on Titan","images":{"jpg":{"large_image_url":"https://cdn.myanimelist.net/images/anime/10/47347l.jpg"}}},
          {"mal_id":20,"title":"Naruto","images":{"jpg":{"large_image_url":"https://cdn.myanimelist.net/images/anime/13/17405l.jpg"}}},
          {"mal_id":5113,"title":"Demon Slayer","images":{"jpg":{"large_image_url":"https://cdn.myanimelist.net/images/anime/1286/99889l.jpg"}}},
          {"mal_id":1535,"title":"Death Note","images":{"jpg":{"large_image_url":"https://cdn.myanimelist.net/images/anime/9/9453l.jpg"}}},
          {"mal_id":11757,"title":"One Punch Man","images":{"jpg":{"large_image_url":"https://cdn.myanimelist.net/images/anime/11/76074l.jpg"}}},
          {"mal_id":30276,"title":"My Hero Academia","images":{"jpg":{"large_image_url":"https://cdn.myanimelist.net/images/anime/1370/114355l.jpg"}}}
        ]);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-center mb-8 text-white">Nanz.to — Anime</h1>
      
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {list.map(anime => (
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
