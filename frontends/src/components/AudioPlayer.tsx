// src/components/AudioPlayer.tsx - Complete rewritten file
'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import './AudioPlayer.css';

interface AudioPlayerProps {
  filename: string;
}

export default function AudioPlayer({ filename }: AudioPlayerProps) {
  const { currentUser } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch audio URL only once when component mounts or filename changes
  useEffect(() => {
    let isMounted = true;
    let objectUrl: string | null = null;

    async function fetchAudioUrl() {
      if (!filename || !currentUser) return;
      
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch(`/local-audio/${filename}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!res.ok) {
          console.error("Failed to fetch audio, status:", res.status);
          if (isMounted) {
            setError(`Failed to load audio file (HTTP ${res.status})`);
          }
          return;
        }
        
        // Handle different response types
        const contentType = res.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          // Handle JSON response with URL
          const data = await res.json();
          if (data.url && isMounted) {
            setAudioUrl(data.url);
            setError(null);
          } else if (isMounted) {
            setError("Invalid URL response from server");
          }
        } else {
          // Handle direct blob response
          const blob = await res.blob();
          objectUrl = URL.createObjectURL(blob);
          if (isMounted) {
            setAudioUrl(objectUrl);
            setError(null);
          }
        }
      } catch (err) {
        console.error("Error fetching audio:", err);
        if (isMounted) {
          setError(`Error loading audio: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    }
    
    fetchAudioUrl();
    
    // Cleanup function to revoke object URL and prevent memory leaks
    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [filename, currentUser]);

  // Set up event listeners when audio element is available
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedData = () => {
      setDuration(audio.duration);
      setAudioLoaded(true);
      setError(null);
    };
    const handleEnded = () => setIsPlaying(false);
    const handleError = (e: Event) => {
      console.error("Audio error:", e);
      setError("Error playing audio file");
      setAudioLoaded(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [audioUrl]);

  // Update audio source when URL is available
  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.load();
    }
  }, [audioUrl]);

  const handlePlayPause = () => {
    if (!audioRef.current || !audioLoaded) return;
    
    if (audioRef.current.paused) {
      // Only attempt to play if audio is fully loaded
      const playPromise = audioRef.current.play();
      
      // Handle the play promise to catch any errors
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch(error => {
            console.error("Play error:", error);
            setIsPlaying(false);
            setError("Error playing audio");
          });
      }
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      audioRef.current.volume = parseFloat(e.target.value);
    }
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current || !audioLoaded) return;
    
    const newTime = (parseFloat(e.target.value) / 100) * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div className="audio-player">
      <audio ref={audioRef} controls={false} preload="metadata" />
      
      {error && <div className="error-message">{error}</div>}
      
      <button 
        onClick={handlePlayPause} 
        disabled={!audioLoaded}
        className={!audioLoaded ? "button-disabled" : ""}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? '⏸️' : '▶️'}
      </button>
      
      <input
        type="range"
        min="0"
        max="100"
        value={(currentTime / duration) * 100 || 0}
        onChange={handleProgressChange}
        disabled={!audioLoaded}
        className={`progress-bar ${!audioLoaded ? "slider-disabled" : ""}`}
        aria-label="Audio progress"
      />
      
      <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
      
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        defaultValue="1"
        onChange={handleVolumeChange}
        disabled={!audioLoaded}
        className={`volume-bar ${!audioLoaded ? "slider-disabled" : ""}`}
        aria-label="Volume control"
      />
    </div>
  );
}
