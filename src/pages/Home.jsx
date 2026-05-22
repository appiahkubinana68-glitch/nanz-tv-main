import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import AnimeCarousel from "../components/AnimeCarousel";
import AdSlot from "../components/AdSlot";
import { Play, ArrowRight, Sparkles } from "lucide-react";

const Home = () => {
  const [trending, setTrending] = useState([]);
  const [top, setTop] = useState([]);
  const [popular, setPopular] = useState([]);
  const [season, setSeason] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [hero, setHero] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async (path, setter, isHero) => {
      try {
        const r = await api.get(path);
        if (!mounted) return;
        const data = r.data?.data || [];
        setter(data);
        if (isHero && data?.length) {
          setHero(data[Math.floor(Math.random() * Math.min(5, data.length))]);
        }
      } catch (e) { /* ignore */ }
    };
    // sequence to respect Jikan rate limit
    (async () => {
      await load("/anime/trending", setTrending, true);
      await load("/anime/top", setTop, false);
      await load("/anime/popular", setPopular, false);
      await load("/anime/season", setSeason, false);
      await load("/anime/upcoming", setUpcoming, false);
    })();
    return () => { mounted = false; };
  }, []);

  const heroImage = hero?.images?.jpg?.large_image_url || hero?.images?.webp?.large_image_url;

  return (
    <div data-testid="home-page">
      {/* HERO */}
      <section className="relative min-h-[80vh] overflow-hidden border-b border-[#272A30]" data-testid="hero-section">
        {heroImage && (
          <div className="absolute inset-0">
            <img src={heroImage} alt="" className="w-full h-full object-cover scale-110" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#090A0C] via-[#090A0C]/80 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#090A0C] via-transparent to-transparent" />
          </div>
        )}
        <div className="relative max-w-[1500px] mx-auto px-6 lg:px-12 pt-20 pb-24">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="text-emerald-400" size={14} />
            <span className="font-mono text-[11px] tracking-[0.3em] uppercase text-emerald-400">Now Trending · Spring</span>
          </div>
          <h1 className="font-display font-black text-5xl sm:text-6xl lg:text-7xl tracking-tighter uppercase leading-[0.9] max-w-3xl">
            {hero?.title_english || hero?.title || "The world's anime, in one place."}
          </h1>
          <p className="mt-6 max-w-xl text-zinc-300 leading-relaxed">
            {hero?.synopsis ? hero.synopsis.slice(0, 220) + "…" : "Discover every anime worth watching. Track, rate, and discuss with a community of fans. No paywalls. No fluff."}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {hero ? (
              <Link to={`/anime/${hero.mal_id}`} data-testid="hero-watch-btn"
                className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold px-6 py-3 inline-flex items-center gap-2 transition-colors">
                <Play size={16} fill="black" /> View Title
              </Link>
            ) : null}
            <Link to="/browse" data-testid="hero-browse-btn"
              className="border border-[#3a3d44] hover:border-emerald-500 hover:text-emerald-400 text-white px-6 py-3 inline-flex items-center gap-2 transition-colors">
              Browse Catalog <ArrowRight size={16} />
            </Link>
          </div>

          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#272A30] border border-[#272A30] max-w-2xl">
            {[
              { k: "25,000+", v: "Titles" },
              { k: "Live", v: "Schedule" },
              { k: "Free", v: "Trailers" },
              { k: "Open", v: "Reviews" },
            ].map((s) => (
              <div key={s.v} className="bg-[#090A0C] p-4">
                <div className="font-display text-2xl font-black tracking-tighter">{s.k}</div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Marquee */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-[#272A30] bg-[#090A0C]/90 overflow-hidden">
          <div className="flex animate-marquee whitespace-nowrap py-3">
            {[...Array(2)].flatMap((_, x) => ["Shōnen", "Seinen", "Slice of Life", "Mecha", "Isekai", "Mystery", "Romance", "Horror", "Sports", "Music"].map((g, i) => (
              <span key={`${x}-${i}`} className="font-display text-xl font-bold uppercase tracking-tight mx-6 text-zinc-600">
                {g} <span className="text-emerald-500">/</span>
              </span>
            )))}
          </div>
        </div>
      </section>

      <AnimeCarousel title="Top Airing" kicker="Right Now" items={trending} testid="carousel-trending" />
      <AnimeCarousel title="All-time Top" kicker="Legends" items={top} testid="carousel-top" />

      {/* Between-sections ad */}
      <div className="px-6 lg:px-12 py-2"><div className="max-w-[1500px] mx-auto"><AdSlot variant="banner" testid="ad-home-mid" /></div></div>

      <AnimeCarousel title="This Season" kicker="Current Cour" items={season} testid="carousel-season" />
      <AnimeCarousel title="Most Popular" kicker="Community Pick" items={popular} testid="carousel-popular" />
      <AnimeCarousel title="Upcoming" kicker="Watchlist Bait" items={upcoming} testid="carousel-upcoming" />

      <section className="px-6 lg:px-12 py-20 border-t border-[#272A30] bg-[#F8F9FA] text-[#111827]">
        <div className="max-w-[1500px] mx-auto grid md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-7">
            <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-emerald-700 mb-3">/ Build your watchlist</div>
            <h2 className="font-display text-4xl sm:text-5xl font-black tracking-tighter uppercase leading-[0.95]">
              Track every series.<br/>Rate. Review. Repeat.
            </h2>
            <p className="mt-4 text-zinc-700 max-w-lg leading-relaxed">Sign in with Google and start curating your personal anime library. Sync watching status, mark favourites, and post comments on any title.</p>
          </div>
          <div className="md:col-span-5">
            <Link to="/browse" data-testid="cta-browse" className="block bg-[#090A0C] text-white p-8 border border-[#090A0C] hover:bg-emerald-500 hover:text-black hover:border-emerald-500 transition-colors">
              <div className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-70">Start Here</div>
              <div className="font-display text-3xl font-black tracking-tighter mt-2 inline-flex items-center gap-3">Explore Catalog <ArrowRight size={22} /></div>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
