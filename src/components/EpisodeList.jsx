import React, { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { Check, Play, ChevronDown } from "lucide-react";
import { toast } from "sonner";

const EpisodeList = ({ malId, animeTitle, animeImage, totalEpisodes, onPlay }) => {
  const { user } = useAuth();
  const [episodes, setEpisodes] = useState([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [watchedSet, setWatchedSet] = useState(new Set());
  const [lastEpisode, setLastEpisode] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const r = await api.get(`/anime/${malId}/episodes`, { params: { page } });
        if (!mounted) return;
        setEpisodes(r.data?.data || []);
        setHasNext(r.data?.pagination?.has_next_page || false);
      } catch { if (mounted) setEpisodes([]); }
      finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [malId, page,user]);

  useEffect(() => {
    if (!user) { setWatchedSet(new Set()); setLastEpisode(0); return; }
    (async () => {
      try {
        const r = await api.get(`/me/progress/${malId}`);
        setWatchedSet(new Set(r.data?.episodes_watched || []));
        setLastEpisode(r.data?.last_episode || 0);
      } catch {}
    })();
  }, [malId, user]);

  const toggle = async (epNum) => {
    if (!user) { toast.error("Sign in to track progress (free)"); return; }
    const isWatched = watchedSet.has(epNum);
    // optimistic
    const next = new Set(watchedSet);
    if (isWatched) next.delete(epNum); else next.add(epNum);
    setWatchedSet(next);
    try {
      const r = await api.post(`/me/progress/${malId}`, {
        episode_number: epNum, watched: !isWatched,
        title: animeTitle, image: animeImage, total_episodes: totalEpisodes || null,
      });
      setLastEpisode(r.data?.last_episode || 0);
    } catch {
      // revert
      setWatchedSet(watchedSet);
      toast.error("Failed to update progress");
    }
  };

  const nextEpisode = lastEpisode + 1;
  const showResume = user && lastEpisode > 0 && episodes.some(e => (e.mal_id || e.episode || 0) >= nextEpisode);

  return (
    <div data-testid="episode-list">
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-emerald-400">/ Episodes</div>
          <h3 className="font-display text-2xl font-bold uppercase tracking-tight mt-1">{episodes.length > 0 ? `${episodes.length}${hasNext ? "+" : ""} listed` : "Episodes"}</h3>
        </div>
        {showResume && (
          <button onClick={() => onPlay?.(nextEpisode)} data-testid="resume-btn"
            className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase tracking-wider px-4 py-2 inline-flex items-center gap-2">
            <Play size={12} fill="black" /> Resume · Ep {nextEpisode}
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({length: 6}).map((_, i) => <div key={i} className="h-12 bg-[#16181D] border border-[#272A30] animate-pulse" />)}</div>
      ) : episodes.length === 0 ? (
        <div className="border border-dashed border-[#272A30] p-8 text-center text-zinc-500 text-sm">No episode data available for this title.</div>
      ) : (
        <div className="border border-[#272A30] divide-y divide-[#272A30]" data-testid="episodes">
          {episodes.map((ep, i) => {
            const epNum = ep.mal_id || ep.episode || (i + 1 + (page - 1) * 100);
            const watched = watchedSet.has(epNum);
            const isNext = user && lastEpisode > 0 && epNum === nextEpisode;
            return (
              <div key={`${page}-${epNum}`} data-ep-num={epNum} data-testid={`episode-${epNum}`}
                   className={`flex items-center gap-4 p-3 ${isNext ? "bg-emerald-500/5 border-l-2 border-l-emerald-500" : ""} hover:bg-[#16181D]/60`}>
                <button onClick={() => toggle(epNum)} aria-label={watched ? "Mark unwatched" : "Mark watched"}
                  data-testid={`ep-toggle-${epNum}`}
                  className={`w-9 h-9 shrink-0 flex items-center justify-center border ${watched ? "bg-emerald-500 border-emerald-500 text-black" : "border-[#272A30] hover:border-emerald-500 text-zinc-500"}`}>
                  {watched ? <Check size={16} /> : <span className="font-mono text-xs">{String(epNum).padStart(2, "0")}</span>}
                </button>
                <button onClick={() => onPlay?.(epNum)} data-testid={`ep-play-${epNum}`}
                  className="flex-1 min-w-0 text-left group/play">
                  <div className="font-display text-sm font-bold leading-tight truncate group-hover/play:text-emerald-400">{ep.title || ep.title_japanese || `Episode ${epNum}`}</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mt-0.5 flex items-center gap-3">
                    {ep.aired && <span>{new Date(ep.aired).toLocaleDateString()}</span>}
                    {ep.filler && <span className="text-amber-400">Filler</span>}
                    {ep.recap && <span className="text-zinc-400">Recap</span>}
                    {ep.score && <span>★ {ep.score}</span>}
                  </div>
                </button>
                <button onClick={() => onPlay?.(epNum)} data-testid={`ep-play-icon-${epNum}`}
                  className="shrink-0 p-2 border border-[#272A30] hover:border-emerald-500 hover:text-emerald-400" aria-label="Play">
                  <Play size={14} fill="currentColor" />
                </button>
                {isNext && <span className="font-mono text-[10px] tracking-widest uppercase text-emerald-400 hidden sm:inline">Up Next</span>}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between font-mono text-xs uppercase tracking-widest text-zinc-500">
        <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} data-testid="ep-prev"
          className="border border-[#272A30] px-3 py-1.5 disabled:opacity-30 hover:border-emerald-500">← Prev</button>
        <span>Page {page}</span>
        <button onClick={() => setPage(page + 1)} disabled={!hasNext} data-testid="ep-next"
          className="border border-[#272A30] px-3 py-1.5 disabled:opacity-30 hover:border-emerald-500">Next →</button>
      </div>
    </div>
  );
};

export default EpisodeList;
