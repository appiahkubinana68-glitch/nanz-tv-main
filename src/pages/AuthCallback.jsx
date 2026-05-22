import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
const AuthCallback = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash || "";
    const match = hash.match(/session_id=([^&]+)/);
    if (!match) {
      navigate("/login", { replace: true });
      return;
    }
    const sessionId = match[1];

    (async () => {
      try {
        const res = await api.post("/auth/session", null, {
          headers: { "X-Session-ID": sessionId },
        });
        setUser(res.data.user);
        // Strip hash and go to home
        window.history.replaceState(null, "", "/");
        navigate("/", { replace: true, state: { user: res.data.user } });
      } catch (e) {
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#090A0C] text-white">
      <div className="text-center">
        <div className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-400 mb-2">Signing you in</div>
        <div className="font-display text-3xl">Connecting…</div>
      </div>
    </div>
  );
};

export default AuthCallback;
