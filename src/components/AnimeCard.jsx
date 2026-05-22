import React from "react";
import { Link } from "react-router-dom";
import { Star, Play } from "lucide-react";

const AnimeCard = ({ anime, index = 0, size = "default" }) => {
  const img = anime?.images?.jpg?.large_image_url || anime?.images?.jpg?.image_url || anime?.image_url;
  const title = anime?.title_english || anime?.title;
  const score = anime?.score;
  const type = anime?.type || "TV";
  const eps = anime?.episodes;

  return (
    <Link
      to={`/anime/${anime.mal_id}`}
      data-testid={`anime-card-${anime.mal_id}`}
      className="anime-card group relative block border border-[#272A30] bg-[#16181D] overflow-hidden rise-in"
      style={{ animationDelay: `${Math.min(index * 40, 600)}ms` }}
    >
      <div className="aspect-[2/3] overflow-hidden relative bg-[#0f1115]">
        {img ? (
          <img src={img} alt={title} loading="lazy" className="anime-cover w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-700 font-display text-4xl">∅</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
        {score ? (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-emerald-500 text-black px-2 py-0.5 text-[11px] font-bold font-mono">
            <Star size={11} fill="black" /> {score.toFixed(1)}
          </div>
        ) : null}
        <div className="absolute top-2 right-2 font-mono text-[10px] tracking-widest uppercase text-zinc-200 bg-black/60 px-2 py-0.5 border border-white/10">
          {type}{eps ? ` · ${eps}ep` : ""}
        </div>
        <div className="absolute inset-0 flex items-end justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-emerald-500 text-black p-2"><Play size={14} fill="black" /></div>
        </div>
      </div>
      <div className="p-3">
        <h3 className="font-display text-sm font-bold leading-tight line-clamp-2 group-hover:text-emerald-400 transition-colors min-h-[2.6em]" title={title}>
          {title}
        </h3>
        <div className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          <span>{anime.year || anime.aired?.prop?.from?.year || "—"}</span>
          <span className="w-1 h-1 bg-zinc-700" />
          <span className="truncate">{anime?.genres?.slice(0, 2).map(g => g.name).join(" · ") || "Anime"}</span>
        </div>
      </div>
    </Link>
  );
};

export default AnimeCard;
