import React from "react";
import { Link } from "react-router-dom";

export default function AnimeCard({ anime }) {
  return (
    <Link to={`/anime/${anime.id}`} className="block group">
      <img 
        src={anime.image} 
        alt={anime.title} 
        className="w-full h-[320px] object-cover rounded-lg shadow-md group-hover:scale-105 transition-transform" 
      />
      <h3 className="mt-2 text-sm font-medium text-center line-clamp-2">{anime.title}</h3>
    </Link>
  );
}
