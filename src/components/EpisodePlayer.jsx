import React, { useEffect, useRef, useState, useCallback } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { Play, ChevronRight, X, AlertCircle, ExternalLink, Loader } from "lucide-react";
import { toast } from "sonner";

/**
 * Legal on-site player.
 * - Only embeds YouTube videos from licensed anime channels (Muse Asia, Ani-One, Crunchyroll Collection, GKIDS, RetroCrush, etc.) — surfaced by backend allowlist.
 * - When no licensed embed exists, shows an outbound CTA to the WatchNow links (already on the right column).
 * - Supports next-episode auto-advance and progress sync.
 */
const EpisodePlayer = ({ malId, animeTitle, animeImage, totalEpisodes, currentEpisode, onClose, onAdvance }) => {
  const { user } = useAuth();
  const [sources, setSources] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [apiConfigured, setApiConfigured] = useState(true);
  const iframeRef = useRef(null);
  const playerRef = useRef(null);
  const [autoAdvance, setAutoAdvance] = useState(true);

  const loadSources = useCallback(async () => {
    setLoading(true);
    setSources([]);
    try {
      const r = await api.get(`/anime/${malId}/episodes/${currentEpisode}/sources`, {
        params: { anime_title: animeTitle },
      });
      setSources(r.data?.data || []);
      setApiConfigured(r.data?.youtube_api_configured !== false);
      setActiveIdx(0);
    } catch {
      setSources([]);
    } finally { setLoading(false); }
  }, [malId, currentEpisode, animeTitle]);

  useEffect(() => { loadSources(); }, [loadSources]);

  // Load YouTube IFrame API for ended-event detection
  useEffect(() => {
    if (window.YT && window.YT.Player) return;
    if (document.getElementById("yt-iframe-api")) return;
    const tag = document.createElement("script");
    tag.id = "yt-iframe-api";
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
  }, []);

  // Mount player when sources/activeIdx ready
  useEffect(() => {
    if (!sources[activeIdx]) return;
    const videoId = sources[activeIdx].youtube_video_id;
    const mount = () => {
      try { playerRef.current?.destroy?.(); } catch {}
      playerRef.current = new window.YT.Player("nanz-player-mount", {
        videoId,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.ENDED) {
              markCurrentWatched();
              if (autoAdvance && currentEpisode < (totalEpisodes || 9999)) {
                setTimeout(() => onAdvance?.(currentEpisode + 1), 800);
              }
            }
          },
        },
      });
    };
    if (window.YT && window.YT.Player) mount();
    else window.onYouTubeIframeAPIReady = mount;
    return () => {
      try { playerRef.current?.destroy?.(); } catch {}
    };
    // eslint-disable-next-line
  }, [sources, activeIdx, autoAdvance, currentEpisode, totalEpisodes]);

  const markCurrentWatched = async () => {
    if (!user) return;
    try {
      await api.post(`/me/progress/${malId}`, {
        episode_number: currentEpisode, watched: true,
        title: animeTitle, image: animeImage, total_episodes: totalEpisodes || null,
      });
    } catch {}
  };

  const noSources = !loading && sources.length === 0;

  return (
    <div className="border border-[#272A30] bg-[#0c0e12]" data-testid="episode-player">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#272A30]">
        <div className="flex items-center gap-3 min-w-0">
          <Play size={14} className="text-emerald-400 shrink-0" fill="#10B981" />
          <div className="font-display font-bold text-sm uppercase tracking-tight truncate">
            Now Playing · Episode {currentEpisode}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-zinc-400 cursor-pointer">
            <input type="checkbox" checked={autoAdvance} onChange={(e) => setAutoAdvance(e.target.checked)} className="accent-emerald-500" data-testid="auto-advance-toggle" />
            Auto-next
          </label>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1" aria-label="Close" data-testid="close-player">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="aspect-video bg-black relative" data-testid="player-frame">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader className="animate-spin text-emerald-400" />
          </div>
        ) : noSources ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center" data-testid="no-sources">
            <AlertCircle className="text-emerald-400 mb-3" />
            <div className="font-display text-xl font-bold uppercase tracking-tight">No legal embed available</div>
            <p className="text-zinc-400 text-sm max-w-md mt-2">
              This episode isn't on a licensed YouTube channel we partner with. Use the <strong className="text-emerald-400">Watch Now</strong> buttons on the right to stream it officially.
            </p>
            {!apiConfigured && (
              <div className="mt-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500 max-w-md">
                Admin tip: set <span className="text-emerald-400">YOUTUBE_API_KEY</span> on backend to enable auto-discovery, or add a source manually in /admin.
              </div>
            )}
          </div>
        ) : (
          <div id="nanz-player-mount" ref={iframeRef} className="w-full h-full" />
        )}
      </div>

      {/* Source picker */}
      {sources.length > 0 && (
        <div className="border-t border-[#272A30] p-3 flex flex-wrap items-center gap-2" data-testid="source-picker">
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mr-2">Sources:</span>
          {sources.map((s, i) => (
            <button key={s.youtube_video_id} onClick={() => setActiveIdx(i)} data-testid={`source-${i}`}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider border ${i === activeIdx ? "bg-emerald-500 border-emerald-500 text-black" : "border-[#272A30] hover:border-emerald-500 text-zinc-300"}`}>
              {s.channel_name}
              {s.manual && <span className="ml-1.5 text-[9px] opacity-70">·M</span>}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            {currentEpisode > 1 && (
              <button onClick={() => onAdvance?.(currentEpisode - 1)} data-testid="prev-ep" className="text-xs font-mono uppercase tracking-widest text-zinc-400 hover:text-emerald-400">
                ← Prev
              </button>
            )}
            {(!totalEpisodes || currentEpisode < totalEpisodes) && (
              <button onClick={() => onAdvance?.(currentEpisode + 1)} data-testid="next-ep"
                className="bg-emerald-500 hover:bg-emerald-400 text-black px-3 py-1.5 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1">
                Next Ep <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="px-4 py-2 border-t border-[#272A30] flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        <span>Licensed embeds only · YouTube official channels</span>
        <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(animeTitle + " episode " + currentEpisode)}`}
           target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 flex items-center gap-1" data-testid="yt-search-fallback">
          Find on YouTube <ExternalLink size={10} />
        </a>
      </div>
    </div>
  );
};

export default EpisodePlayer;
