import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { Star, Heart, Plus, Calendar, Clock, Tv, Trash2, Play } from "lucide-react";
import { toast } from "sonner";
import AnimeCard from "../components/AnimeCard";
import EpisodeList from "../components/EpisodeList";
import EpisodePlayer from "../components/EpisodePlayer";
import WatchNow from "../components/WatchNow";
import AdSlot from "../components/AdSlot";

const STATUS_OPTIONS = [
  { value: "watching", label: "Watching" },
  { value: "completed", label: "Completed" },
  { value: "plan_to_watch", label: "Plan to Watch" },
  { value: "dropped", label: "Dropped" },
];

const AnimeDetail = () => {
  const { id } = useParams();
  const malId = parseInt(id, 10);
  const { user } = useAuth();
  const [anime, setAnime] = useState(null);
  const [recs, setRecs] = useState([]);
  const [comments, setComments] = useState([]);
  const [avgRating, setAvgRating] = useState(null);
  const [ratingsCount, setRatingsCount] = useState(0);
  const [userScore, setUserScore] = useState(null);
  const [newComment, setNewComment] = useState("");
  const [watchStatus, setWatchStatus] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playingEp, setPlayingEp] = useState(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [d, c, recsR] = await Promise.all([
        api.get(`/anime/${malId}`),
        api.get(`/anime/${malId}/comments`),
        api.get(`/anime/${malId}/recommendations`),
      ]);
      setAnime(d.data?.data || null);
      setComments(c.data?.data || []);
      setAvgRating(c.data?.average_rating);
      setRatingsCount(c.data?.ratings_count || 0);
      const recArr = recsR.data?.data || [];
      setRecs(recArr.slice(0, 12).map(r => r.entry || r));
    } catch (e) {
      // ignore
    } finally { setLoading(false); }

    if (user) {
      try { const mr = await api.get(`/anime/${malId}/my-rating`); setUserScore(mr.data?.user_score); } catch {}
      try {
        const w = await api.get("/me/watchlist");
        const found = (w.data?.data || []).find(x => x.mal_id === malId);
        setWatchStatus(found?.status || "");
      } catch {}
      try {
        const f = await api.get("/me/favorites");
        setIsFavorite((f.data?.data || []).some(x => x.mal_id === malId));
      } catch {}
    }
  };

  useEffect(() => { loadAll(); /* eslint-disable-line */ }, [malId, user?.user_id]);

  const requireAuth = () => {
    if (!user) { toast.error("Sign in required", { description: "Please sign in to use this feature." }); return false; }
    return true;
  };

  const submitRating = async (score) => {
    if (!requireAuth()) return;
    try {
      const r = await api.post(`/anime/${malId}/rate`, { mal_id: malId, score });
      setAvgRating(r.data.average_rating);
      setRatingsCount(r.data.ratings_count);
      setUserScore(score);
      toast.success(`Rated ${score} / 5`);
    } catch { toast.error("Failed to rate"); }
  };

  const setStatus = async (status) => {
    if (!requireAuth()) return;
    try {
      await api.post("/me/watchlist", {
        mal_id: malId, title: anime?.title, image: anime?.images?.jpg?.large_image_url || anime?.images?.jpg?.image_url, status,
      });
      setWatchStatus(status);
      toast.success(`Added to ${status.replace("_", " ")}`);
    } catch { toast.error("Failed to update watchlist"); }
  };

  const removeFromWatchlist = async () => {
    if (!user) return;
    try { await api.delete(`/me/watchlist/${malId}`); setWatchStatus(""); toast.success("Removed from watchlist"); } catch {}
  };

  const toggleFavorite = async () => {
    if (!requireAuth()) return;
    try {
      if (isFavorite) { await api.delete(`/me/favorites/${malId}`); setIsFavorite(false); toast.success("Removed from favorites"); }
      else { await api.post("/me/favorites", { mal_id: malId, title: anime?.title, image: anime?.images?.jpg?.large_image_url }); setIsFavorite(true); toast.success("Added to favorites"); }
    } catch { toast.error("Failed"); }
  };

  const postComment = async (e) => {
    e.preventDefault();
    if (!requireAuth()) return;
    if (!newComment.trim()) return;
    try {
      const r = await api.post(`/anime/${malId}/comments`, { text: newComment.trim() });
      setComments([r.data, ...comments]);
      setNewComment("");
      toast.success("Comment posted");
    } catch { toast.error("Failed to post"); }
  };

  const deleteComment = async (cid) => {
    try { await api.delete(`/anime/${malId}/comments/${cid}`); setComments(comments.filter(c => c.comment_id !== cid)); }
    catch { toast.error("Failed"); }
  };

  if (loading || !anime) {
    return <div className="min-h-screen flex items-center justify-center"><div className="font-mono text-xs tracking-widest text-emerald-400">LOADING…</div></div>;
  }

  const banner = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url;
  const trailerYt = anime.trailer?.youtube_id;

  return (
    <div data-testid="anime-detail-page">
      {/* Banner */}
      <section className="relative overflow-hidden border-b border-[#272A30]">
        <div className="absolute inset-0">
          {banner && <img src={banner} alt="" className="w-full h-full object-cover scale-110 blur-md opacity-40" />}
          <div className="absolute inset-0 bg-gradient-to-t from-[#090A0C] via-[#090A0C]/85 to-[#090A0C]/60" />
        </div>
        <div className="relative max-w-[1500px] mx-auto px-6 lg:px-12 py-16 grid md:grid-cols-12 gap-8">
          <div className="md:col-span-3">
            {banner && <img src={banner} alt={anime.title} className="w-full border border-[#272A30] aspect-[2/3] object-cover" />}
          </div>
          <div className="md:col-span-9">
            <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-emerald-400 mb-2">{anime.type || "Anime"} · {anime.status || "—"}</div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter uppercase leading-[0.95]" data-testid="anime-title">{anime.title_english || anime.title}</h1>
            {anime.title_japanese && <div className="font-mono text-sm text-zinc-500 mt-2">{anime.title_japanese}</div>}

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              {anime.score && <div className="flex items-center gap-1.5"><Star size={14} className="text-emerald-400" fill="#10B981" /> <span className="font-bold">{anime.score}</span><span className="text-zinc-500"> MAL</span></div>}
              {avgRating != null && <div className="flex items-center gap-1.5 border-l border-[#272A30] pl-5"><Star size={14} className="text-emerald-400" fill="#10B981" /> <span className="font-bold">{avgRating}</span><span className="text-zinc-500">/5 · {ratingsCount} users</span></div>}
              {anime.episodes && <div className="flex items-center gap-1.5 text-zinc-400"><Tv size={14} /> {anime.episodes} eps</div>}
              {anime.duration && <div className="flex items-center gap-1.5 text-zinc-400"><Clock size={14} /> {anime.duration}</div>}
              {anime.aired?.from && <div className="flex items-center gap-1.5 text-zinc-400"><Calendar size={14} /> {new Date(anime.aired.from).getFullYear()}</div>}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {(anime.genres || []).map(g => (
                <span key={g.mal_id || g.name} className="font-mono text-[10px] uppercase tracking-widest px-2 py-1 border border-[#272A30] text-zinc-300">{g.name}</span>
              ))}
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <div className="flex">
                {STATUS_OPTIONS.map(o => (
                  <button key={o.value} onClick={() => setStatus(o.value)} data-testid={`status-${o.value}`}
                    className={`px-3 py-2 text-xs font-bold uppercase tracking-wider border ${watchStatus === o.value ? "bg-emerald-500 border-emerald-500 text-black" : "border-[#272A30] hover:border-emerald-500"}`}>
                    {o.label}
                  </button>
                ))}
                {watchStatus && (
                  <button onClick={removeFromWatchlist} data-testid="watchlist-remove" className="px-3 py-2 border border-[#272A30] hover:border-red-500 hover:text-red-400"><Trash2 size={14} /></button>
                )}
              </div>
              <button onClick={toggleFavorite} data-testid="favorite-toggle"
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border inline-flex items-center gap-2 ${isFavorite ? "bg-emerald-500 border-emerald-500 text-black" : "border-[#272A30] hover:border-emerald-500"}`}>
                <Heart size={14} fill={isFavorite ? "black" : "none"} /> {isFavorite ? "Favourited" : "Favourite"}
              </button>
            </div>

            <p className="mt-7 text-zinc-300 leading-relaxed max-w-3xl" data-testid="anime-synopsis">{anime.synopsis || "No synopsis available."}</p>

            {/* Ad slot - below description */}
            <div className="mt-8 max-w-3xl">
              <AdSlot variant="banner" testid="ad-below-synopsis" />
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 lg:px-12 py-14 grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7 space-y-10">
          {trailerYt ? (
            <div>
              <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-emerald-400 mb-3">/ Trailer</div>
              <div className="aspect-video border border-[#272A30] bg-black">
                <iframe data-testid="trailer-iframe" title="trailer" className="w-full h-full" src={`https://www.youtube.com/embed/${trailerYt}`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
              </div>
            </div>
          ) : (
            <div className="border border-[#272A30] p-10 text-center text-zinc-500 flex flex-col items-center gap-3" data-testid="no-trailer">
              <Play size={28} /> <span>No official trailer available.</span>
            </div>
          )}

          {/* Episodes */}
          {playingEp && (
            <EpisodePlayer
              malId={malId}
              animeTitle={anime.title}
              animeImage={anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url}
              totalEpisodes={anime.episodes}
              currentEpisode={playingEp}
              onClose={() => setPlayingEp(null)}
              onAdvance={(n) => setPlayingEp(n)}
            />
          )}
          <EpisodeList
            malId={malId}
            animeTitle={anime.title}
            animeImage={anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url}
            totalEpisodes={anime.episodes}
            onPlay={(n) => { setPlayingEp(n); setTimeout(() => { document.querySelector('[data-testid="episode-player"]')?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 100); }}
          />

          {/* Rating widget */}
          <div className="border border-[#272A30] p-6">
            <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-emerald-400 mb-3">/ Your Rating</div>
            <div className="flex items-center gap-3 star-row" data-testid="rating-stars">
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => submitRating(n)} data-testid={`rate-${n}`} className="star-icon text-zinc-600 hover:text-emerald-400" style={{ color: userScore && n <= userScore ? "#10B981" : undefined }}>
                  <Star size={28} fill={userScore && n <= userScore ? "#10B981" : "none"} />
                </button>
              ))}
              <span className="ml-3 text-zinc-500 text-sm font-mono">{userScore ? `You: ${userScore}/5` : "Tap a star"}</span>
            </div>
          </div>

          {/* Comments */}
          <div>
            <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-emerald-400 mb-3">/ Discussion · {comments.length}</div>
            <form onSubmit={postComment} className="border border-[#272A30] p-4" data-testid="comment-form">
              <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder={user ? "Share your thoughts…" : "Sign in to comment"} disabled={!user} rows={3}
                className="w-full bg-transparent outline-none text-sm resize-none placeholder:text-zinc-600" data-testid="comment-input" />
              <div className="flex justify-end mt-2">
                <button type="submit" disabled={!user || !newComment.trim()} data-testid="comment-submit"
                  className="bg-emerald-500 text-black px-4 py-2 text-xs font-bold uppercase tracking-wider disabled:opacity-40 hover:bg-emerald-400">Post</button>
              </div>
            </form>
            <div className="mt-6 space-y-5" data-testid="comments-list">
              {comments.length === 0 && <div className="text-zinc-500 text-sm">Be the first to comment.</div>}
              {comments.map(c => (
                <div key={c.comment_id} className="border-l border-[#272A30] pl-4 group" data-testid={`comment-${c.comment_id}`}>
                  <div className="flex items-center gap-3">
                    {c.user_picture ? <img src={c.user_picture} alt="" className="w-7 h-7 object-cover border border-[#272A30]" /> : <div className="w-7 h-7 bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">{c.user_name?.[0]}</div>}
                    <div>
                      <div className="text-sm font-bold">{c.user_name}</div>
                      <div className="font-mono text-[10px] text-zinc-600">{new Date(c.created_at).toLocaleString()}</div>
                    </div>
                    {user?.user_id === c.user_id && (
                      <button onClick={() => deleteComment(c.comment_id)} className="ml-auto opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400" data-testid={`comment-delete-${c.comment_id}`}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="mt-2 text-zinc-300 text-sm leading-relaxed">{c.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="lg:col-span-5 space-y-6">
          {/* Sidebar ad - top */}
          <AdSlot variant="sidebar" testid="ad-sidebar-top" />

          {/* Watch Now official links */}
          <WatchNow malId={malId} animeTitle={anime.title} />

          <div className="bg-[#F8F9FA] text-[#111827] p-6 border border-[#E5E7EB]">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-emerald-700">/ Information</div>
            <div className="mt-4 grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
              <Info label="Type" value={anime.type} />
              <Info label="Episodes" value={anime.episodes} />
              <Info label="Status" value={anime.status} />
              <Info label="Aired" value={anime.aired?.string} />
              <Info label="Season" value={[anime.season, anime.year].filter(Boolean).join(" ")} />
              <Info label="Source" value={anime.source} />
              <Info label="Studios" value={(anime.studios || []).map(s => s.name).join(", ")} />
              <Info label="Rating" value={anime.rating} />
            </div>
          </div>

          {recs?.length > 0 && (
            <div className="mt-8">
              <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-emerald-400 mb-3">/ You might also like</div>
              <div className="grid grid-cols-3 gap-3" data-testid="recommendations">
                {recs.slice(0, 6).map((r, i) => <AnimeCard key={r.mal_id} anime={r} index={i} />)}
              </div>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
};

const Info = ({ label, value }) => (
  <div>
    <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-zinc-500">{label}</div>
    <div className="font-medium text-sm mt-0.5">{value || "—"}</div>
  </div>
);

export default AnimeDetail;
