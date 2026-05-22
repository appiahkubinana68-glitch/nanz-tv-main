import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Search, Menu, X, LogOut, User as UserIcon, Heart, Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import AdSlot from "./AdSlot";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
const handleLogin = () => {
  const redirectUrl = window.location.origin + "/";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
};

const Header = () => {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const submitSearch = (e) => {
    e.preventDefault();
    if (q.trim()) navigate(`/browse?q=${encodeURIComponent(q.trim())}`);
  };

  const links = [
    { to: "/", label: "Discover" },
    { to: "/browse", label: "Browse" },
    { to: "/browse?status=airing", label: "Airing" },
    { to: "/admin", label: "Add Anime" },
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#090A0C]/85 border-b border-[#272A30]" data-testid="app-header">
      {/* Free-access reassurance + header banner ad */}
      <div className="bg-[#0c0e12] border-b border-[#272A30] px-6 lg:px-12 py-1.5 flex items-center justify-between gap-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500 hidden sm:block">
          <span className="text-emerald-400">●</span> 100% Free · No Subscription · No Sign-up Required to Browse
        </div>
        <div className="flex-1 max-w-md"><AdSlot variant="banner" testid="ad-header-banner" /></div>
      </div>
      <div className="max-w-[1500px] mx-auto px-6 lg:px-12 h-16 flex items-center gap-8">
        <Link to="/" className="flex items-center gap-2 group" data-testid="logo-link">
          <span className="w-2.5 h-2.5 bg-emerald-500 inline-block group-hover:scale-125 transition-transform" />
          <span className="font-display font-black text-xl tracking-tighter uppercase">Nanz<span className="text-emerald-500">.</span>tv</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          {links.map((l) => (
            <Link key={l.to} to={l.to} data-testid={`nav-${l.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={`text-sm font-medium link-underline ${location.pathname + location.search === l.to ? "text-emerald-400" : "text-zinc-300 hover:text-white"}`}>
              {l.label}
            </Link>
          ))}
        </nav>

        <form onSubmit={submitSearch} className="hidden md:flex items-center flex-1 max-w-md ml-auto" data-testid="search-form">
          <div className="flex items-center w-full border-b border-[#272A30] focus-within:border-emerald-500 transition-colors">
            <Search size={16} className="text-zinc-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search anime, genres, studios…"
              data-testid="search-input"
              className="bg-transparent px-3 py-2 text-sm w-full outline-none placeholder:text-zinc-500"
            />
            <span className="font-mono text-[10px] text-zinc-600 tracking-widest">↵</span>
          </div>
        </form>

        <div className="hidden md:flex items-center gap-3 ml-2">
          {user ? (
            <div className="flex items-center gap-3">
              <Link to="/profile" data-testid="profile-link" className="flex items-center gap-2 group">
                {user.picture ? (
                  <img src={user.picture} alt="" className="w-8 h-8 object-cover border border-[#272A30] group-hover:border-emerald-500" />
                ) : (
                  <div className="w-8 h-8 bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">{user.name?.[0] || "U"}</div>
                )}
                <span className="text-sm text-zinc-300 group-hover:text-white">{user.name?.split(" ")[0]}</span>
              </Link>
              <button onClick={logout} data-testid="logout-btn" title="Logout" className="p-2 text-zinc-400 hover:text-white border border-transparent hover:border-[#272A30]">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button onClick={handleLogin} data-testid="login-btn"
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 font-bold text-sm tracking-wide transition-colors">
              Sign In
            </button>
          )}
        </div>

        <button className="md:hidden ml-auto" onClick={() => setOpen(!open)} data-testid="mobile-menu-toggle">
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-[#272A30] bg-[#090A0C] px-6 py-5 space-y-4">
          <form onSubmit={submitSearch} className="flex items-center border-b border-[#272A30] pb-2">
            <Search size={16} className="text-zinc-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="bg-transparent px-3 py-1 text-sm w-full outline-none" data-testid="mobile-search-input" />
          </form>
          {links.map((l) => (
            <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="block text-sm text-zinc-300">{l.label}</Link>
          ))}
          {user ? (
            <button onClick={logout} className="text-sm text-zinc-400 flex items-center gap-2"><LogOut size={14} /> Sign out</button>
          ) : (
            <button onClick={handleLogin} className="bg-emerald-500 text-white px-4 py-2 font-bold text-sm" data-testid="mobile-login-btn">Sign In</button>
          )}
        </div>
      )}
    </header>
  );
};

export default Header;
