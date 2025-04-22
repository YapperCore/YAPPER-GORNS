// src/components/AudioPlayer.tsx
'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import '../static/AudioPlayer.css'; // Updated path to CSS

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
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(1);

  console.log("AudioPlayer component mounted with filename:", filename);

  // Fetch audio URL
  useEffect(() => {
    let objectUrl: string | null = null;

    async function fetchAudioUrl() {
      if (!filename || !currentUser) {
        console.log("Missing filename or user, cannot load audio");
        return;
      }
      
      try {
        console.log("Fetching audio from server...");
        const token = await currentUser.getIdToken();
        
        // Try both endpoints - first the direct audio path, then local-audio
        let res = await fetch(`/api/audio/${filename}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!res.ok) {
          console.log("Trying alternate endpoint...");
          res = await fetch(`/local-audio/${filename}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }
        
        if (!res.ok) {
          setError(`Failed to load audio (${res.status})`);
          console.error("Audio fetch failed with status:", res.status);
          return;
        }
        
        // Handle different response types
        const contentType = res.headers.get('content-type');
        console.log("Received content type:", contentType);
        
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          if (data.url) {
            setAudioSrc(data.url);
            setError(null);
          } else {
            setError("Invalid URL response");
          }
        } else {
          const blob = await res.blob();
          objectUrl = URL.createObjectURL(blob);
          setAudioSrc(objectUrl);
          setError(null);
          console.log("Created object URL for audio blob");
        }
      } catch (err) {
        console.error("Error fetching audio:", err);
        setError(`Error loading audio: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
    
    fetchAudioUrl();
    
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [filename, currentUser]);

  // Set up audio element listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;
    
    // Set source
    audio.src = audioSrc;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedData = () => {
      setDuration(audio.duration);
      setAudioLoaded(true);
    };
    const handleEnded = () => setIsPlaying(false);
    const handleError = () => {
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
  }, [audioSrc]);

  const handlePlayPause = () => {
    if (!audioRef.current || !audioLoaded) return;
    
    if (audioRef.current.paused) {
      const playPromise = audioRef.current.play();
      
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
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
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
      {audioSrc && <audio ref={audioRef} preload="metadata" src={audioSrc} />}
      
      {error && <div className="error-message">{error}</div>}
      
      <button 
        onClick={handlePlayPause} 
        disabled={!audioLoaded || !audioSrc}
        className={!audioLoaded || !audioSrc ? "button-disabled" : ""}
      >
        {isPlaying ? "⏸" : "▶"}
      </button>
      
      <input 
        type="range" 
        min="0" 
        max="100" 
        value={(currentTime / (duration || 1)) * 100} 
        onChange={handleProgressChange}
        className={`progress-bar ${!audioLoaded || !audioSrc ? "slider-disabled" : ""}`}
        disabled={!audioLoaded || !audioSrc}
      />
      
      <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
      
      <input 
        type="range" 
        min="0" 
        max="1" 
        step="0.01" 
        value={volume}
        onChange={handleVolumeChange}
        className={`volume-bar ${!audioLoaded || !audioSrc ? "slider-disabled" : ""}`}
        disabled={!audioLoaded || !audioSrc}
      />
    </div>
  );
}
