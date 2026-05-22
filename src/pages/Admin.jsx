import React, { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Plus, ShieldAlert, Save, Search, ExternalLink, Zap, X } from "lucide-react";

const Admin = () => {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(null);
  const [tab, setTab] = useState("custom");
  const [form, setForm] = useState({ title: "", synopsis: "", image_url: "", year: "", type: "TV", status: "Finished Airing", episodes: "", genres: "", trailer_youtube_id: "" });
  const [list, setList] = useState([]);

  // Streaming editor state
  const [allowedSites, setAllowedSites] = useState([]);
  const [lookupId, setLookupId] = useState("");
  const [lookupAnime, setLookupAnime] = useState(null);
  const [streamLinks, setStreamLinks] = useState([]);
  const [savingStreams, setSavingStreams] = useState(false);

  // Episode sources state
  const [esMalId, setEsMalId] = useState("");
  const [esEpNum, setEsEpNum] = useState("");
  const [esVideo, setEsVideo] = useState("");
  const [esChannel, setEsChannel] = useState("");
  const [esList, setEsList] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  useEffect(() => {
    (async () => {
      try { const r = await api.get("/auth/is-admin"); setIsAdmin(!!r.data?.is_admin); } catch { setIsAdmin(false); }
      try { const r = await api.get("/anime/custom"); setList(r.data?.data || []); } catch {}
      try { const r = await api.get("/streaming/allowed"); setAllowedSites(r.data?.data || []); } catch {}
    })();
  }, [user]);

  if (loading || isAdmin === null) return null;
  if (!user) return <Navigate to="/login" replace />;

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" data-testid="admin-denied">
        <div className="max-w-md text-center border border-[#272A30] p-10">
          <ShieldAlert className="mx-auto text-emerald-500 mb-4" size={32} />
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-emerald-400">/ Restricted</div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tighter mt-2">Admin Only</h1>
          <p className="text-zinc-400 mt-3 text-sm">Curation is restricted to the site owner. You're signed in as <span className="text-white">{user.email}</span>.</p>
          <Link to="/" className="inline-block mt-6 bg-emerald-500 text-black font-bold uppercase text-sm tracking-wider px-5 py-2.5">Back to Discover</Link>
        </div>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.image_url) { toast.error("Title and image URL are required"); return; }
    try {
      const payload = {
        title: form.title,
        synopsis: form.synopsis,
        image_url: form.image_url,
        year: form.year ? parseInt(form.year, 10) : null,
        type: form.type,
        status: form.status,
        episodes: form.episodes ? parseInt(form.episodes, 10) : null,
        genres: form.genres.split(",").map(g => g.trim()).filter(Boolean),
        trailer_youtube_id: form.trailer_youtube_id || null,
      };
      const r = await api.post("/anime/custom", payload);
      setList([r.data, ...list]);
      setForm({ title: "", synopsis: "", image_url: "", year: "", type: "TV", status: "Finished Airing", episodes: "", genres: "", trailer_youtube_id: "" });
      toast.success("Custom anime added");
    } catch (e) { toast.error("Failed: " + (e.response?.data?.detail || "error")); }
  };

  const lookupStreaming = async () => {
    const id = parseInt(lookupId, 10);
    if (!id) { toast.error("Enter a valid MAL ID"); return; }
    try {
      const [a, s] = await Promise.all([
        api.get(`/anime/${id}`),
        api.get(`/anime/${id}/streaming`),
      ]);
      setLookupAnime(a.data?.data || null);
      setStreamLinks(s.data?.data || []);
      toast.success("Loaded");
    } catch { toast.error("Anime not found"); }
  };

  const updateLink = (site, url) => {
    setStreamLinks((prev) => {
      const others = prev.filter((l) => l.site !== site);
      if (!url) return others;
      return [...others, { site, url }];
    });
  };

  const saveStreaming = async () => {
    const id = parseInt(lookupId, 10);
    if (!id) return;
    setSavingStreams(true);
    try {
      const cleaned = streamLinks.filter((l) => l.url && l.url.startsWith("http"));
      await api.post(`/anime/${id}/streaming-overrides`, { links: cleaned });
      toast.success("Streaming links saved");
    } catch { toast.error("Save failed"); }
    finally { setSavingStreams(false); }
  };

  const fld = (k) => ({ value: form[k], onChange: (e) => setForm({ ...form, [k]: e.target.value }), "data-testid": `field-${k}` });
  const inputCls = "w-full bg-transparent border-b border-[#272A30] focus:border-emerald-500 px-1 py-2 outline-none placeholder:text-zinc-600";

  return (
    <div className="min-h-screen px-6 lg:px-12 py-14" data-testid="admin-page">
      <div className="max-w-[1500px] mx-auto">
        <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-emerald-400 mb-2">/ Curate · admin</div>
        <h1 className="font-display text-5xl font-black tracking-tighter uppercase">Curation Console</h1>
        <div className="font-mono text-xs text-zinc-500 mt-1">Signed in as {user.email}</div>

        {/* Tabs */}
        <div className="mt-8 border-b border-[#272A30] flex gap-1 flex-wrap">
          {[
            { v: "custom", l: "Add Custom Anime" },
            { v: "streaming", l: "Streaming Links" },
            { v: "episodes", l: "Episode Sources" },
          ].map(t => (
            <button key={t.v} onClick={() => setTab(t.v)} data-testid={`admin-tab-${t.v}`}
              className={`px-5 py-3 font-display font-bold uppercase tracking-tight text-sm border-b-2 ${tab === t.v ? "border-emerald-500 text-emerald-400" : "border-transparent text-zinc-400 hover:text-white"}`}>
              {t.l}
            </button>
          ))}
        </div>

        {tab === "custom" && (
          <div className="mt-10 grid lg:grid-cols-12 gap-12">
            <div className="lg:col-span-7">
              <form onSubmit={submit} className="space-y-6" data-testid="admin-form">
                <Field label="Title *"><input {...fld("title")} className={inputCls} placeholder="e.g. Chainsaw Man" /></Field>
                <Field label="Cover Image URL *"><input {...fld("image_url")} className={inputCls} placeholder="https://…" /></Field>
                <Field label="Synopsis"><textarea {...fld("synopsis")} rows={4} className={inputCls + " resize-none"} /></Field>
                <div className="grid grid-cols-2 gap-6">
                  <Field label="Year"><input type="number" {...fld("year")} className={inputCls} placeholder="2024" /></Field>
                  <Field label="Episodes"><input type="number" {...fld("episodes")} className={inputCls} placeholder="12" /></Field>
                  <Field label="Type">
                    <select {...fld("type")} className={inputCls + " text-white"}>
                      {["TV", "Movie", "OVA", "ONA", "Special"].map(t => <option key={t} value={t} className="bg-[#090A0C]">{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Status">
                    <select {...fld("status")} className={inputCls + " text-white"}>
                      {["Currently Airing", "Finished Airing", "Not yet aired"].map(s => <option key={s} value={s} className="bg-[#090A0C]">{s}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Genres (comma separated)"><input {...fld("genres")} className={inputCls} placeholder="Action, Drama, Supernatural" /></Field>
                <Field label="Trailer YouTube ID"><input {...fld("trailer_youtube_id")} className={inputCls} placeholder="dQw4w9WgXcQ" /></Field>
                <button type="submit" data-testid="admin-submit" className="bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-3 font-bold uppercase tracking-wider inline-flex items-center gap-2">
                  <Plus size={16} /> Save Anime
                </button>
              </form>
            </div>

            <aside className="lg:col-span-5">
              <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-emerald-400 mb-3">/ Recently Added · {list.length}</div>
              <div className="space-y-4" data-testid="admin-list">
                {list.length === 0 && <div className="text-zinc-500 text-sm">No custom titles yet.</div>}
                {list.map((it) => (
                  <Link key={it.custom_id} to={`/anime/${it.mal_id}`} className="flex gap-4 border border-[#272A30] hover:border-emerald-500 p-3">
                    <img src={it.image_url} alt="" className="w-16 h-24 object-cover" />
                    <div>
                      <div className="font-display text-lg font-bold leading-tight">{it.title}</div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mt-1">{it.type} · {it.year || "—"} · {it.episodes || "?"} ep</div>
                      <div className="text-xs text-zinc-400 mt-2 line-clamp-3">{it.synopsis}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </aside>
          </div>
        )}

        {tab === "streaming" && (
          <div className="mt-10 grid lg:grid-cols-12 gap-12">
            <div className="lg:col-span-7">
              <p className="text-zinc-400 max-w-xl mb-6 text-sm leading-relaxed">Override or add official streaming URLs per anime. Auto-pulled from AniList; your overrides win when both exist. Only whitelisted platforms allowed.</p>

              <div className="flex gap-3 items-end border-b border-[#272A30] pb-4">
                <div className="flex-1">
                  <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-emerald-400 mb-1">MAL ID</div>
                  <input value={lookupId} onChange={(e) => setLookupId(e.target.value)} placeholder="e.g. 21 (One Piece)" data-testid="lookup-mal-id"
                    className={inputCls} />
                </div>
                <button onClick={lookupStreaming} data-testid="lookup-btn"
                  className="bg-emerald-500 text-black font-bold uppercase text-xs tracking-wider px-4 py-2.5 inline-flex items-center gap-2">
                  <Search size={14} /> Load
                </button>
              </div>

              {lookupAnime && (
                <div className="mt-6" data-testid="streaming-editor">
                  <div className="flex gap-4 mb-6">
                    <img src={lookupAnime.images?.jpg?.image_url} alt="" className="w-20 h-28 object-cover border border-[#272A30]" />
                    <div>
                      <div className="font-display text-xl font-bold">{lookupAnime.title}</div>
                      <div className="font-mono text-xs text-zinc-500 mt-1">MAL: {lookupAnime.mal_id}</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {allowedSites.map((site) => {
                      const current = streamLinks.find((l) => l.site === site)?.url || "";
                      return (
                        <div key={site} className="grid grid-cols-12 gap-3 items-center" data-testid={`edit-row-${site.replace(/\s+/g,'-').toLowerCase()}`}>
                          <div className="col-span-3 font-display font-bold text-sm">{site}</div>
                          <input value={current} onChange={(e) => updateLink(site, e.target.value)} placeholder="https://…"
                            data-testid={`edit-url-${site.replace(/\s+/g,'-').toLowerCase()}`}
                            className="col-span-8 bg-transparent border-b border-[#272A30] focus:border-emerald-500 px-1 py-2 outline-none text-sm" />
                          {current && (
                            <a href={current} target="_blank" rel="noopener noreferrer" className="col-span-1 text-emerald-400 hover:text-emerald-300"><ExternalLink size={14} /></a>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <button onClick={saveStreaming} disabled={savingStreams} data-testid="save-streaming"
                    className="mt-8 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-bold uppercase text-sm tracking-wider px-5 py-2.5 inline-flex items-center gap-2">
                    <Save size={14} /> {savingStreams ? "Saving…" : "Save Streaming Links"}
                  </button>
                </div>
              )}
            </div>

            <aside className="lg:col-span-5">
              <div className="bg-[#F8F9FA] text-[#111827] p-6 border border-[#E5E7EB]">
                <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-emerald-700">/ Allowed Platforms</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {allowedSites.map(s => <div key={s} className="border border-[#E5E7EB] px-3 py-2 text-sm">{s}</div>)}
                </div>
                <p className="text-xs text-zinc-600 mt-4">Nanz.tv only links to <strong>official</strong> streaming and never hosts video files. Submit only direct title pages on these platforms.</p>
              </div>
            </aside>
          </div>
        )}

        {tab === "episodes" && (
          <div className="mt-10 grid lg:grid-cols-12 gap-12" data-testid="episodes-admin-tab">
            <div className="lg:col-span-7">
              <p className="text-zinc-400 max-w-xl mb-6 text-sm leading-relaxed">
                Add YouTube video IDs from licensed channels (Muse Asia, Ani-One Asia, Crunchyroll Collection, GKIDS, RetroCrush…). These play directly on every episode page. Auto-scan uses your YouTube API quota.
              </p>

              <div className="border-b border-[#272A30] pb-6 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <Field label="MAL ID"><input value={esMalId} onChange={(e) => setEsMalId(e.target.value)} placeholder="20" className={inputCls} data-testid="es-malid" /></Field>
                  <Field label="Episode #"><input value={esEpNum} onChange={(e) => setEsEpNum(e.target.value)} placeholder="1" className={inputCls} data-testid="es-epnum" /></Field>
                  <Field label="Channel (optional)"><input value={esChannel} onChange={(e) => setEsChannel(e.target.value)} placeholder="Muse Asia" className={inputCls} data-testid="es-channel" /></Field>
                </div>
                <Field label="YouTube Video URL or ID">
                  <input value={esVideo} onChange={(e) => setEsVideo(e.target.value)} placeholder="https://youtu.be/abc123XYZ_0 or abc123XYZ_0" className={inputCls} data-testid="es-video" />
                </Field>
                <div className="flex flex-wrap gap-3">
                  <button onClick={async () => {
                    const malId = parseInt(esMalId, 10), epNum = parseInt(esEpNum, 10);
                    if (!malId || !epNum || !esVideo) { toast.error("MAL ID, Episode #, and YouTube ID required"); return; }
                    try {
                      await api.post("/admin/episode-sources", { mal_id: malId, episode_number: epNum, youtube_video_id: esVideo, channel_name: esChannel || null });
                      toast.success("Source added"); setEsVideo("");
                      const r = await api.get(`/admin/episode-sources/${malId}`);
                      setEsList(r.data?.data || []);
                    } catch (e) { toast.error("Failed: " + (e.response?.data?.detail || "error")); }
                  }} data-testid="es-add-btn" className="bg-emerald-500 hover:bg-emerald-400 text-black px-5 py-2.5 font-bold uppercase text-sm tracking-wider inline-flex items-center gap-2">
                    <Plus size={14} /> Add Source
                  </button>
                  <button onClick={async () => {
                    const malId = parseInt(esMalId, 10);
                    if (!malId) { toast.error("MAL ID required"); return; }
                    try { const r = await api.get(`/admin/episode-sources/${malId}`); setEsList(r.data?.data || []); toast.success(`Loaded ${r.data?.data?.length || 0} sources`); }
                    catch { toast.error("Failed to load"); }
                  }} data-testid="es-load-btn" className="border border-[#272A30] hover:border-emerald-500 px-5 py-2.5 font-bold uppercase text-sm tracking-wider inline-flex items-center gap-2">
                    <Search size={14} /> Load Sources
                  </button>
                  <button onClick={async () => {
                    const malId = parseInt(esMalId, 10);
                    if (!malId) { toast.error("MAL ID required"); return; }
                    setScanning(true); setScanResult(null);
                    try {
                      const r = await api.post(`/admin/episode-sources/${malId}/auto-scan`, null, { params: { max_episodes: 12 } });
                      setScanResult(r.data); toast.success(`Scanned: ${r.data?.with_matches}/${r.data?.scanned?.length} eps found`);
                    } catch (e) { toast.error(e.response?.data?.detail || "Scan failed (YouTube API key required)"); }
                    finally { setScanning(false); }
                  }} disabled={scanning} data-testid="es-scan-btn" className="border border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-black disabled:opacity-50 px-5 py-2.5 font-bold uppercase text-sm tracking-wider inline-flex items-center gap-2">
                    <Zap size={14} /> {scanning ? "Scanning…" : "Auto-Scan"}
                  </button>
                </div>
                {scanResult && (
                  <div className="border border-[#272A30] p-4 text-xs">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-emerald-400 mb-2">Scan Result · {scanResult.anime_title}</div>
                    <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
                      {scanResult.scanned?.map(s => (
                        <div key={s.episode} className={`p-2 text-center border font-mono text-[10px] ${s.matches > 0 ? "border-emerald-500 text-emerald-400" : "border-[#272A30] text-zinc-500"}`}>
                          {s.episode}<div>{s.matches}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6">
                <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-emerald-400 mb-3">/ Manual Sources · {esList.length}</div>
                <div className="space-y-2" data-testid="es-list">
                  {esList.length === 0 && <div className="text-zinc-500 text-sm">No manual sources. Use Load Sources or Auto-Scan above.</div>}
                  {esList.map(it => (
                    <div key={it.source_id} className="flex items-center gap-3 border border-[#272A30] p-3">
                      <div className="font-mono text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1">EP {it.episode_number}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-display text-sm font-bold truncate">{it.title || it.youtube_video_id}</div>
                        <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{it.channel_name} · {it.youtube_video_id}</div>
                      </div>
                      <a href={`https://youtu.be/${it.youtube_video_id}`} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300"><ExternalLink size={14} /></a>
                      <button onClick={async () => {
                        try { await api.delete(`/admin/episode-sources/${it.source_id}`); setEsList(esList.filter(x => x.source_id !== it.source_id)); toast.success("Removed"); }
                        catch { toast.error("Failed"); }
                      }} className="text-zinc-500 hover:text-red-400" data-testid={`es-delete-${it.source_id}`}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <aside className="lg:col-span-5">
              <div className="bg-[#F8F9FA] text-[#111827] p-6 border border-[#E5E7EB]">
                <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-emerald-700">/ Licensed Channels</div>
                <p className="text-xs text-zinc-600 mt-2 mb-4">Only embeds from these official channels are accepted — they permit third-party embedding under YouTube's standard policy.</p>
                <div className="space-y-2">
                  {["Muse Asia", "Ani-One Asia", "Crunchyroll Collection", "GKIDS Films", "RetroCrush", "Ani-One Asia Classic"].map(c => (
                    <div key={c} className="border border-[#E5E7EB] px-3 py-2 text-sm flex items-center gap-2"><span className="w-1.5 h-1.5 bg-emerald-500" /> {c}</div>
                  ))}
                </div>
                <p className="text-xs text-zinc-600 mt-5">Auto-Scan uses your <strong>YOUTUBE_API_KEY</strong> server env var (set in /app/backend/.env). Set it once and Nanz.tv auto-discovers embeds for the whole catalog.</p>
              </div>
            </aside>
          </div>
        )}

      </div>
    </div>
  );
};

const Field = ({ label, children }) => (
  <label className="block">
    <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-emerald-400 block mb-1">{label}</span>
    {children}
  </label>
);

export default Admin;
