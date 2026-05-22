import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import AnimeCard from "../components/AnimeCard";
import { Filter, X, ChevronLeft, ChevronRight, Search } from "lucide-react";

const TYPES = ["TV", "Movie", "OVA", "ONA", "Special"];
const STATUSES = [
  { value: "airing", label: "Airing" },
  { value: "complete", label: "Finished" },
  { value: "upcoming", label: "Upcoming" },
];
const SORTS = [
  { value: "popularity", label: "Popularity" },
  { value: "score", label: "Score" },
  { value: "rank", label: "Rank" },
  { value: "title", label: "Title (A-Z)" },
  { value: "start_date", label: "Newest" },
];

const Browse = () => {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pagination, setPagination] = useState({ has_next_page: false, current_page: 1, last_visible_page: 1 });
  const [searchInput, setSearchInput] = useState(params.get("q") || "");

  const q = params.get("q") || "";
  const genre = params.get("genres") || "";
  const type = params.get("type") || "";
  const status = params.get("status") || "";
  const order_by = params.get("order_by") || "popularity";
  const sort = params.get("sort") || "asc";
  const page = parseInt(params.get("page") || "1", 10);

  const updateParam = useCallback((key, value) => {
    const next = new URLSearchParams(params);
    if (value === "" || value == null) next.delete(key); else next.set(key, value);
    if (key !== "page") next.set("page", "1");
    setParams(next);
  }, [params, setParams]);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("/anime/genres");
        setGenres(r.data?.data || []);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const r = await api.get("/anime/browse", {
          params: { q, genres: genre || undefined, type: type || undefined, status: status || undefined, order_by, sort, page, limit: 24 },
        });
        if (!mounted) return;
        setItems(r.data?.data || []);
        setPagination(r.data?.pagination || { has_next_page: false, current_page: page, last_visible_page: page });
      } catch (e) {
        if (mounted) setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [q, genre, type, status, order_by, sort, page]);

  const submitSearch = (e) => { e.preventDefault(); updateParam("q", searchInput.trim()); };

  const clearFilters = () => setParams(new URLSearchParams());

  return (
    <div className="min-h-screen" data-testid="browse-page">
      <section className="px-6 lg:px-12 py-12 border-b border-[#272A30]">
        <div className="max-w-[1500px] mx-auto">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-emerald-400 mb-2">/ Catalog</div>
              <h1 className="font-display text-5xl sm:text-6xl font-black tracking-tighter uppercase">Browse Anime</h1>
              <p className="text-zinc-400 mt-2 max-w-xl">Filter through tens of thousands of titles from the MAL database.</p>
            </div>
            <button onClick={() => setDrawerOpen(true)} data-testid="filter-drawer-toggle"
              className="border border-[#272A30] hover:border-emerald-500 hover:text-emerald-400 px-5 py-3 inline-flex items-center gap-2 transition-colors">
              <Filter size={16} /> Filters
            </button>
          </div>

          <form onSubmit={submitSearch} className="mt-8 flex items-center border-b-2 border-[#272A30] focus-within:border-emerald-500 max-w-xl" data-testid="browse-search-form">
            <Search size={18} className="text-zinc-500" />
            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search by title…" data-testid="browse-search-input"
              className="bg-transparent px-3 py-3 w-full outline-none text-base placeholder:text-zinc-600" />
            <button type="submit" className="font-mono text-xs uppercase tracking-widest text-emerald-400 hover:text-emerald-300">Search →</button>
          </form>

          {(q || genre || type || status) && (
            <div className="mt-5 flex flex-wrap gap-2" data-testid="active-filters">
              {q && <Chip label={`q: ${q}`} onClear={() => { setSearchInput(""); updateParam("q", ""); }} />}
              {genre && <Chip label={`genre: ${genres.find(g => String(g.mal_id) === genre)?.name || genre}`} onClear={() => updateParam("genres", "")} />}
              {type && <Chip label={`type: ${type}`} onClear={() => updateParam("type", "")} />}
              {status && <Chip label={`status: ${status}`} onClear={() => updateParam("status", "")} />}
              <button onClick={clearFilters} className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 hover:text-white" data-testid="clear-filters-btn">Clear all</button>
            </div>
          )}
        </div>
      </section>

      <section className="px-6 lg:px-12 py-10">
        <div className="max-w-[1500px] mx-auto">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Array.from({ length: 12 }).map((_, i) => <div key={i} className="aspect-[2/3] bg-[#16181D] border border-[#272A30] animate-pulse" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="py-20 text-center">
              <div className="font-display text-3xl">No matches found</div>
              <p className="text-zinc-500 mt-2">Try removing some filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4" data-testid="browse-grid">
              {items.map((a, i) => <AnimeCard key={a.mal_id} anime={a} index={i} />)}
            </div>
          )}

          <div className="mt-10 flex items-center justify-between border-t border-[#272A30] pt-6">
            <div className="font-mono text-xs uppercase tracking-widest text-zinc-500">Page {pagination.current_page} of {pagination.last_visible_page || "?"}</div>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => updateParam("page", String(page - 1))} data-testid="pagination-prev"
                className="border border-[#272A30] p-2 disabled:opacity-30 disabled:cursor-not-allowed hover:border-emerald-500"><ChevronLeft size={16} /></button>
              <button disabled={!pagination.has_next_page} onClick={() => updateParam("page", String(page + 1))} data-testid="pagination-next"
                className="border border-[#272A30] p-2 disabled:opacity-30 disabled:cursor-not-allowed hover:border-emerald-500"><ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      </section>

      {/* Filter drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex" data-testid="filter-drawer">
          <div className="flex-1 bg-black/60" onClick={() => setDrawerOpen(false)} />
          <aside className="w-full max-w-md bg-white text-[#111827] overflow-y-auto">
            <div className="p-6 border-b border-[#E5E7EB] flex items-center justify-between sticky top-0 bg-white">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-emerald-700">/ Filters</div>
                <div className="font-display text-2xl font-black uppercase tracking-tighter">Refine results</div>
              </div>
              <button onClick={() => setDrawerOpen(false)} data-testid="filter-close-btn" className="p-2 border border-[#E5E7EB] hover:border-[#111827]"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-8">
              <FilterGroup label="Type">
                <div className="flex flex-wrap gap-2">
                  {TYPES.map(t => (
                    <button key={t} onClick={() => updateParam("type", type === t ? "" : t)} data-testid={`filter-type-${t}`}
                      className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider border ${type === t ? "bg-[#111827] text-white border-[#111827]" : "border-[#E5E7EB] hover:border-[#111827]"}`}>{t}</button>
                  ))}
                </div>
              </FilterGroup>
              <FilterGroup label="Status">
                <div className="flex flex-wrap gap-2">
                  {STATUSES.map(s => (
                    <button key={s.value} onClick={() => updateParam("status", status === s.value ? "" : s.value)} data-testid={`filter-status-${s.value}`}
                      className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider border ${status === s.value ? "bg-[#111827] text-white border-[#111827]" : "border-[#E5E7EB] hover:border-[#111827]"}`}>{s.label}</button>
                  ))}
                </div>
              </FilterGroup>
              <FilterGroup label="Genre">
                <div className="flex flex-wrap gap-1.5 max-h-64 overflow-y-auto">
                  {genres.map(g => (
                    <button key={g.mal_id} onClick={() => updateParam("genres", String(g.mal_id) === genre ? "" : String(g.mal_id))} data-testid={`filter-genre-${g.mal_id}`}
                      className={`px-2.5 py-1 text-[11px] tracking-wider border ${String(g.mal_id) === genre ? "bg-emerald-500 text-white border-emerald-500" : "border-[#E5E7EB] hover:border-[#111827]"}`}>{g.name}</button>
                  ))}
                </div>
              </FilterGroup>
              <FilterGroup label="Sort by">
                <div className="space-y-2">
                  <select value={order_by} onChange={(e) => updateParam("order_by", e.target.value)} data-testid="filter-order-by"
                    className="w-full border border-[#E5E7EB] px-3 py-2 bg-white focus:border-[#111827] outline-none">
                    {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <select value={sort} onChange={(e) => updateParam("sort", e.target.value)} data-testid="filter-sort-dir"
                    className="w-full border border-[#E5E7EB] px-3 py-2 bg-white focus:border-[#111827] outline-none">
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                  </select>
                </div>
              </FilterGroup>
              <div className="pt-4 border-t border-[#E5E7EB] flex gap-3">
                <button onClick={clearFilters} className="flex-1 border border-[#111827] px-4 py-3 font-bold uppercase text-sm tracking-wide hover:bg-[#111827] hover:text-white" data-testid="filter-clear-btn">Clear</button>
                <button onClick={() => setDrawerOpen(false)} className="flex-1 bg-emerald-500 text-white px-4 py-3 font-bold uppercase text-sm tracking-wide hover:bg-emerald-600" data-testid="filter-apply-btn">Apply</button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

const FilterGroup = ({ label, children }) => (
  <div>
    <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-emerald-700 mb-3">{label}</div>
    {children}
  </div>
);

const Chip = ({ label, onClear }) => (
  <span className="inline-flex items-center gap-1.5 border border-[#272A30] px-2.5 py-1 text-xs">
    {label} <button onClick={onClear} className="text-zinc-500 hover:text-white"><X size={12} /></button>
  </span>
);

export default Browse;
