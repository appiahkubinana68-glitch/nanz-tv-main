import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Heart, Trash2 } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABELS = {
  watching: "Watching",
  completed: "Completed",
  plan_to_watch: "Plan to Watch",
  dropped: "Dropped",
};

const Profile = () => {
  const { user, loading } = useAuth();
  const [watchlist, setWatchlist] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [continueWatching, setContinueWatching] = useState([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try { const w = await api.get("/me/watchlist"); setWatchlist(w.data?.data || []); } catch {}
      try { const f = await api.get("/me/favorites"); setFavorites(f.data?.data || []); } catch {}
      try { const c = await api.get("/me/continue-watching"); setContinueWatching(c.data?.data || []); } catch {}
    })();
  }, [user]);

  if (loading) return <div className="min-h-screen flex items-center justify-center font-mono text-xs text-emerald-400">LOADING…</div>;
  if (!user) return <Navigate to="/login" replace />;

  const grouped = {
    watching: watchlist.filter(w => w.status === "watching"),
    completed: watchlist.filter(w => w.status === "completed"),
    plan_to_watch: watchlist.filter(w => w.status === "plan_to_watch"),
    dropped: watchlist.filter(w => w.status === "dropped"),
  };

  const removeWatch = async (mal_id) => {
    try { await api.delete(`/me/watchlist/${mal_id}`); setWatchlist(watchlist.filter(x => x.mal_id !== mal_id)); toast.success("Removed"); } catch {}
  };
  const removeFav = async (mal_id) => {
    try { await api.delete(`/me/favorites/${mal_id}`); setFavorites(favorites.filter(x => x.mal_id !== mal_id)); toast.success("Removed"); } catch {}
  };

  return (
    <div className="min-h-screen" data-testid="profile-page">
      <section className="border-b border-[#272A30] px-6 lg:px-12 py-14 bg-[#F8F9FA] text-[#111827]">
        <div className="max-w-[1500px] mx-auto flex flex-wrap items-end gap-8">
          {user.picture ? <img src={user.picture} alt="" className="w-28 h-28 object-cover border border-[#E5E7EB]" /> : <div className="w-28 h-28 bg-emerald-500/20 text-emerald-700 flex items-center justify-center text-4xl font-display font-black">{user.name?.[0]}</div>}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-emerald-700">/ Member Profile</div>
            <h1 className="font-display text-5xl font-black tracking-tighter uppercase">{user.name}</h1>
            <div className="font-mono text-xs text-zinc-600">{user.email}</div>
          </div>
          <div className="ml-auto grid grid-cols-3 gap-6 text-center">
            <Stat value={watchlist.length} label="In Lists" />
            <Stat value={favorites.length} label="Favorites" />
            <Stat value={grouped.completed.length} label="Completed" />
          </div>
        </div>
      </section>

      <section className="px-6 lg:px-12 py-12">
        <div className="max-w-[1500px] mx-auto">
          <Tabs defaultValue="continue" className="w-full">
            <TabsList className="bg-transparent border-b border-[#272A30] rounded-none p-0 h-auto w-full justify-start overflow-x-auto" data-testid="profile-tabs">
              <TabsTrigger value="continue" data-testid="tab-continue"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:text-emerald-400 data-[state=active]:shadow-none px-5 py-3 font-display font-bold uppercase tracking-tight">
                Continue Watching <span className="font-mono text-xs text-zinc-500 ml-2">{continueWatching.length}</span>
              </TabsTrigger>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <TabsTrigger key={key} value={key} data-testid={`tab-${key}`}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:text-emerald-400 data-[state=active]:shadow-none px-5 py-3 font-display font-bold uppercase tracking-tight">
                  {label} <span className="font-mono text-xs text-zinc-500 ml-2">{grouped[key].length}</span>
                </TabsTrigger>
              ))}
              <TabsTrigger value="favorites" data-testid="tab-favorites"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:text-emerald-400 data-[state=active]:shadow-none px-5 py-3 font-display font-bold uppercase tracking-tight">
                Favorites <span className="font-mono text-xs text-zinc-500 ml-2">{favorites.length}</span>
              </TabsTrigger>
            </TabsList>

            {Object.entries(STATUS_LABELS).map(([key]) => (
              <TabsContent key={key} value={key} className="mt-8">
                {grouped[key].length === 0 ? (
                  <EmptyState label={STATUS_LABELS[key]} />
                ) : (
                  <Grid items={grouped[key]} onRemove={removeWatch} />
                )}
              </TabsContent>
            ))}

            <TabsContent value="favorites" className="mt-8">
              {favorites.length === 0 ? <EmptyState label="Favorites" /> : <Grid items={favorites} onRemove={removeFav} isFav />}
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
};

const Stat = ({ value, label }) => (
  <div>
    <div className="font-display text-3xl font-black tracking-tighter">{value}</div>
    <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500">{label}</div>
  </div>
);

const EmptyState = ({ label }) => (
  <div className="border border-dashed border-[#272A30] p-12 text-center">
    <Heart className="mx-auto text-zinc-700 mb-3" />
    <div className="font-display text-xl">Nothing here yet</div>
    <div className="text-zinc-500 text-sm mt-1">Add titles to your "{label}" list from any anime detail page.</div>
    <Link to="/browse" className="inline-block mt-5 bg-emerald-500 text-black px-5 py-2 font-bold text-sm uppercase tracking-wide hover:bg-emerald-400">Browse anime</Link>
  </div>
);

const Grid = ({ items, onRemove, isFav }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
    {items.map((it) => (
      <div key={it.mal_id} className="relative group border border-[#272A30]">
        <Link to={`/anime/${it.mal_id}`} className="block">
          <div className="aspect-[2/3] overflow-hidden bg-[#0f1115]">
            {it.image ? <img src={it.image} alt={it.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <div className="w-full h-full" />}
          </div>
          <div className="p-3">
            <div className="font-display text-sm font-bold line-clamp-2">{it.title}</div>
            {!isFav && <div className="font-mono text-[10px] uppercase tracking-widest text-emerald-400 mt-1">{it.status?.replace("_", " ")}</div>}
          </div>
        </Link>
        <button onClick={() => onRemove(it.mal_id)} className="absolute top-2 right-2 bg-black/70 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-500" data-testid={`remove-${it.mal_id}`}>
          <Trash2 size={14} />
        </button>
      </div>
    ))}
  </div>
);

export default Profile;
