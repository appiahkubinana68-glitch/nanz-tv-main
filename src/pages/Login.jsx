import React from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
const handleLogin = () => {
  const redirectUrl = window.location.origin + "/";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
};

const Login = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen grid md:grid-cols-2" data-testid="login-page">
      <div className="bg-[#090A0C] p-10 md:p-20 flex flex-col justify-between">
        <Link to="/" className="font-display font-black uppercase text-xl tracking-tighter">Senpai<span className="text-emerald-500">.</span>db</Link>
        <div>
          <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-emerald-400 mb-3">/ Sign in</div>
          <h1 className="font-display text-5xl sm:text-6xl font-black tracking-tighter uppercase leading-[0.95]">Welcome<br/>back, <span className="text-emerald-500">friend.</span></h1>
          <p className="text-zinc-400 mt-5 max-w-md">Track your anime, rate your favourites, and join the conversation. One Google click and you're in.</p>
          <button onClick={handleLogin} data-testid="google-login-btn"
            className="mt-10 bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-7 py-4 inline-flex items-center gap-3 transition-colors">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path fill="#000" d="M21.6 12.227c0-.708-.064-1.39-.182-2.045H12v3.868h5.385a4.605 4.605 0 0 1-1.996 3.022v2.51h3.23c1.892-1.743 2.98-4.31 2.98-7.355z"/>
              <path fill="#000" d="M12 22c2.7 0 4.964-.895 6.619-2.418l-3.23-2.51c-.895.6-2.04.955-3.389.955-2.605 0-4.81-1.76-5.6-4.124H2.99v2.59A9.997 9.997 0 0 0 12 22z"/>
              <path fill="#000" d="M6.4 13.903A6 6 0 0 1 6.085 12c0-.66.114-1.302.315-1.903V7.507H2.99A9.997 9.997 0 0 0 2 12c0 1.614.386 3.14 1.07 4.493l3.33-2.59z"/>
              <path fill="#000" d="M12 5.977c1.47 0 2.787.505 3.825 1.498l2.864-2.864C16.96 2.99 14.696 2 12 2A9.997 9.997 0 0 0 2.99 7.507l3.41 2.59C7.19 7.736 9.395 5.977 12 5.977z"/>
            </svg>
            Continue with Google
          </button>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-600">© Nanz.tv · Powered by Jikan / MAL</div>
      </div>
      <div className="hidden md:block relative">
        <img src="https://images.unsplash.com/photo-1660831519595-dd4dafe57a31?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-l from-transparent to-[#090A0C]/40" />
        <div className="absolute bottom-10 left-10 right-10 text-white">
          <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-emerald-300 mb-2">/ A different kind of catalog</div>
          <div className="font-display text-3xl font-black uppercase tracking-tighter">Curated. Fast. Free.</div>
        </div>
      </div>
    </div>
  );
};

export default Login;
