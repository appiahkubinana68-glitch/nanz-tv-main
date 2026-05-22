import React, { useEffect, useState } from "react";
import { api } from "../api";

export default function EpisodeList({ malId }) {
  const [anime, setAnime] = useState(null);
  const [currentStream, setCurrentStream] = useState("");

  useEffect(() => {
    const fetch = async () => {
      const res = await api.get(`/anime/${malId}`);
      setAnime(res.data);
    };
    fetch();
  }, [malId]);

  if (!anime) return <div className="text-center p-10 text-white">Loading...</div>;

  return (
    <div className="container mx-auto p-4 text-white">
      <h1 className="text-2xl font-bold mb-4">{anime.title}</h1>

      {/* ✅ WORKING VIDEO PLAYER */}
      {currentStream && (
        <video controls src={currentStream} className="w-full h-[500px] rounded-lg mb-6" />
      )}

      <div className="grid grid-cols-8 gap-2">
        {anime.episode_list?.map((ep, i) => (
          <button 
            key={i}
            onClick={() => setCurrentStream(ep.stream_url)}
            className="bg-gray-800 hover:bg-gray-700 p-2 rounded text-sm"
          >
            Ep {ep.episode_id || i+1}
          </button>
        ))}
      </div>
    </div>
  );
}
