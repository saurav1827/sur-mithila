'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const WatchContext = createContext();

export function WatchProvider({ children }) {
  const [autoplay, setAutoplay] = useState(false);
  const [nextSong, setNextSong] = useState(null);
  const router = useRouter();

  // Persist autoplay preference
  useEffect(() => {
    const saved = localStorage.getItem('sur-mithila-autoplay');
    if (saved) setAutoplay(saved === 'true');
  }, []);

  const toggleAutoplay = (val) => {
    setAutoplay(val);
    localStorage.setItem('sur-mithila-autoplay', val);
  };

  // Pre-fetch the next song for instant loading if autoplay is on
  useEffect(() => {
    if (autoplay && nextSong?.slug) {
      router.prefetch(`/songs/${nextSong.slug}`);
    }
  }, [autoplay, nextSong, router]);

  const playNext = () => {
    if (nextSong?.slug) {
      router.push(`/songs/${nextSong.slug}`);
    }
  };

  return (
    <WatchContext.Provider value={{ autoplay, setAutoplay: toggleAutoplay, nextSong, setNext: setNextSong, playNext }}>
      {children}
    </WatchContext.Provider>
  );
}

export function useWatch() {
  return useContext(WatchContext);
}
