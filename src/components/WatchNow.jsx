import React, { useEffect, useState } from "react";
import { api } from "../api";
import { ExternalLink, Tv, ShoppingBag } from "lucide-react";

const SITE_COLORS = {
  "Crunchyroll": "#F47521",
  "Netflix": "#E50914",
  "Amazon Prime Video": "#00A8E1",
  "Hulu": "#1CE783",
  "Tubi": "#7408FF",
  "Pluto TV": "#FCD000",
  "RetroCrush": "#FF5E5B",
};

const WatchNow = ({ malId, animeTitle }) => {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await api.get(`/anime/${malId}/streaming`);
        if (mounted) setLinks(r.data?.data || []);
      } catch {}
      finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [malId]);

  const safeTitle = encodeURIComponent(animeTitle || "");

  return (
    <div className="bg-[#F8F9FA] text-[#111827] p-6 border border-[#E5E7EB]" data-testid="watch-now-block">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-emerald-700">/ Watch Now</div>
          <div className="font-display text-xl font-bold uppercase tracking-tight">Official Streaming</div>
        </div>
        <Tv size={20} className="text-emerald-700" />
      </div>

      {loading ? (
        <div className="mt-4 space-y-2">{Array.from({length: 2}).map((_, i) => <div key={i} className="h-10 bg-[#E5E7EB] animate-pulse" />)}</div>
      ) : links.length === 0 ? (
        <div className="mt-4 text-xs text-zinc-600">No official listings found. Try a direct search:</div>
      ) : (
        <div className="mt-4 space-y-2" data-testid="streaming-links">
          {links.map((l) => (
            <a key={l.site} href={l.url} target="_blank" rel="noopener noreferrer" data-testid={`stream-${l.site.replace(/\s+/g, "-").toLowerCase()}`}
               className="flex items-center justify-between gap-3 border border-[#111827] px-4 py-2.5 hover:bg-[#111827] hover:text-white transition-colors group">
              <span className="flex items-center gap-3">
                <span className="w-2 h-2 inline-block" style={{ background: SITE_COLORS[l.site] || "#10B981" }} />
                <span className="font-display font-bold text-sm">{l.site}</span>
              </span>
              <ExternalLink size={14} className="opacity-60 group-hover:opacity-100" />
            </a>
          ))}
        </div>
      )}

      {/* Official Merch — affiliate placeholders */}
      <div className="mt-6 pt-5 border-t border-[#E5E7EB]">
        <div className="flex items-center gap-2 mb-3">
          <ShoppingBag size={14} className="text-emerald-700" />
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-emerald-700">/ Official Merch</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <a href={`https://www.crunchyroll.com/store/search?q=${safeTitle}`} target="_blank" rel="noopener noreferrer" data-testid="merch-crunchyroll"
             className="text-xs border border-[#E5E7EB] px-3 py-2 hover:border-[#111827] flex items-center justify-between">
            <span>Crunchyroll Store</span><ExternalLink size={12} />
          </a>
          <a href={`https://www.amazon.com/s?k=${safeTitle}+anime&tag=`} target="_blank" rel="noopener noreferrer" data-testid="merch-amazon"
             className="text-xs border border-[#E5E7EB] px-3 py-2 hover:border-[#111827] flex items-center justify-between">
            <span>Amazon</span><ExternalLink size={12} />
          </a>
        </div>
        <div className="font-mono text-[9px] text-zinc-500 mt-3 leading-relaxed">External links · affiliate-ready. Nanz.tv does not host video files.</div>
      </div>
    </div>
  );
};

export default WatchNow;
