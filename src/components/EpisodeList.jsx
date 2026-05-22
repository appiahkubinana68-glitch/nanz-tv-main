import React, { useEffect, useState } from "react";
import { api } from "../api";

export default function EpisodeList({ malId }) {
  const [anime, setAnime] = useState(null);
  const [currentStream, setCurrentStream] = useState("");
  const [epTitle, setEpTitle] = useState("");

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get(`/anime/${malId}`);
        setAnime(res.data);
      } catch (err) {
        console.error("Error", err);
      }
    };
    fetch();
  }, [malId]);

  if (!anime) return <div className="text-center p-20 text-white">Loading...</div>;

  return (
    <div className="container mx-auto p-4 text-white">
      <h1 className="text-3xl font-bold mb-2">{anime.title}</h1>
      <p className="mb-6 text-gray-300">{anime.synopsis?.slice(0,300)}...</p>

      {/* ✅ REAL WORKING PLAYER */}
      {currentStream && (
        <div className="mb-8">
          <h3 className="mb-2 text-lg font-medium">Now Playing: {epTitle}</h3>
          <video 
            controls 
            src={currentStream} 
            className="w-full h-[580px] rounded-lg bg-black"
            autoPlay
            poster={anime.images?.jpg?.large_image_url}
          />
        </div>
      )}

      {/* ✅ ALL EPISODES — CLICK TO PLAY */}
      <h3 className="text-xl font-semibold mb-3">Episodes ({anime.episode_list?.length || 0})</h3>
      <div className="grid grid-cols-8 gap-2">
        {anime.episode_list?.map((ep, i) => (
          <button 
            key={i}
            onClick={() => { setCurrentStream(ep.stream_url); setEpTitle(ep.title || `Ep ${ep.number || i+1}`); }}
            className="bg-gray-800 hover:bg-gray-700 p-3 rounded text-sm transition"
          >
            Ep {ep.number || i+1}
          </button>
        ))}
      </div>
    </div>
  );
}
