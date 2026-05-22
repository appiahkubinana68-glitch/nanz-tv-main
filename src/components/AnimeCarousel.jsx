import React, { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import AnimeCard from "./AnimeCard";

const AnimeCarousel = ({ title, kicker, items, testid }) => {
  const ref = useRef(null);

  const scroll = (dir) => {
    if (!ref.current) return;
    ref.current.scrollBy({ left: dir * 600, behavior: "smooth" });
  };

  return (
    <section className="px-6 lg:px-12 py-10" data-testid={testid}>
      <div className="max-w-[1500px] mx-auto">
        <div className="flex items-end justify-between mb-6">
          <div>
            {kicker && <div className="font-mono text-[11px] tracking-[0.25em] uppercase text-emerald-400 mb-1">{kicker}</div>}
            <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tighter uppercase">{title}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => scroll(-1)} data-testid={`${testid}-prev`} className="p-2 border border-[#272A30] hover:border-emerald-500 hover:text-emerald-400 transition-colors">
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => scroll(1)} data-testid={`${testid}-next`} className="p-2 border border-[#272A30] hover:border-emerald-500 hover:text-emerald-400 transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div ref={ref} className="no-scrollbar flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
          {(items || []).map((a, i) => (
            <div key={a.mal_id} className="snap-start shrink-0 w-[180px] sm:w-[200px]">
              <AnimeCard anime={a} index={i} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AnimeCarousel;
