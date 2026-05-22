import React, { useEffect, useState } from "react";
import { api } from "../api";

export default function EpisodeList({ malId }) {
  const [anime, setAnime] = useState(null);
  const [activeStream, setActiveStream] = useState(null);

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

  if (!anime) return <div className="text-center p-20 text-white">Loading official streams...</div>;

  return (
    <div className="container mx-auto p-4 text-white">
      <div className="grid md:grid-cols-3 gap-8">
        <div>
          <img src={anime.images?.jpg?.large_image_url} alt={anime.title} className="rounded-lg w-full shadow-lg" />
          
          <div className="mt-6 space-y-3">
            <h3 className="text-lg font-semibold text-green-400">✅ Official Legal Streams</h3>
            {anime.legal_streams?.map((stream, i) => (
              stream.type === "link" ? (
                <a 
                  key={i}
                  href={stream.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-blue-600 hover:bg-blue-700 p-3 rounded text-center transition"
                >
                  {stream.name} • {stream.quality}
                </a>
              ) : (
                <button 
                  key={i}
                  onClick={() => setActiveStream(stream)}
                  className="block w-full bg-gray-700 hover:bg-gray-600 p-3 rounded text-center transition"
                >
                  {stream.name}
                </button>
              )
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          <h1 className="text-4xl font-bold mb-2">{anime.title}</h1>
          <p className="text-gray-300 mb-4">{anime.status} • {anime.episodes || "Ongoing"} Episodes</p>
          <p className="mb-8 leading-relaxed">{anime.synopsis}</p>

          {/* ✅ OFFICIAL EMBED PLAYER */}
          {activeStream && (
            <div className="mb-8">
              <h3 className="mb-3 text-xl font-medium">{activeStream.name}</h3>
              <iframe
                src={activeStream.embed_url}
                className="w-full h-[500px] rounded-lg"
                allowFullScreen
                frameBorder="0"
              />
              <p className="mt-2 text-sm text-gray-400">{activeStream.note}</p>
            </div>
          )}

          {/* ✅ OFFICIAL TRAILER */}
          <div className="mt-10">
            <h3 className="text-xl font-semibold mb-3">🎬 Official Trailer</h3>
            <iframe
              src={anime.official_trailer}
              className="w-full h-[300px] rounded-lg"
              allowFullScreen
              frameBorder="0"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
