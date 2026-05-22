import React from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { Toaster } from "./components/ui/sonner";

import Header from "./components/Header";
import AdSlot from "./components/AdSlot";
import Home from "./pages/Home";
import Browse from "./pages/Browse";
import AnimeDetail from "./pages/AnimeDetail";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import AuthCallback from "./pages/AuthCallback";

function AppRouter() {
  const location = useLocation();
  // Check URL fragment synchronously to handle OAuth return
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/anime/:id" element={<AnimeDetail />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
      <footer className="border-t border-[#272A30] mt-20 px-6 lg:px-12 py-10">
        <div className="max-w-[1500px] mx-auto space-y-6">
          <AdSlot variant="footer" testid="ad-footer" />
          <div className="flex flex-wrap items-center justify-between gap-4 font-mono text-[11px] tracking-[0.2em] uppercase text-zinc-600">
            <div>Nanz<span className="text-emerald-500">.</span>tv · A different anime catalog</div>
            <div>Data: Jikan / MyAnimeList · Streaming: AniList · Trailers: YouTube</div>
          </div>
        </div>
      </footer>
    </>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster richColors position="top-right" theme="dark" />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
