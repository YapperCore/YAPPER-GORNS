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
  const [volume, setVolume] = useState(0.8);
  const progressRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let objectUrl: string | null = null;

    async function fetchAudioUrl() {
      if (!filename || !currentUser) return;
      
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch(`/local-audio/${filename}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!res.ok) {
          setError(`Failed to load audio (${res.status})`);
          return;
        }
        
        const contentType = res.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          if (data.url) {
            setAudioUrl(data.url);
            setError(null);
          } else {
            setError("Invalid URL response");
          }
        } else {
          const blob = await res.blob();
          objectUrl = URL.createObjectURL(blob);
          setAudioUrl(objectUrl);
          setError(null);
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

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (progressRef.current) {
        progressRef.current.value = ((audio.currentTime / audio.duration) * 100).toString();
      }
    };
    
    const handleLoadedData = () => {
      setDuration(audio.duration);
      setAudioLoaded(true);
      audio.volume = volume;
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
  }, [audioSrc, volume]);

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
      <audio ref={audioRef} src={audioSrc || undefined} preload="metadata" />
      
      {error && <div className="player-error">{error}</div>}
      
      <div className="player-controls">
        <button 
          className="play-pause-btn"
          onClick={handlePlayPause} 
          disabled={!audioLoaded}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? 
            <i className="pi pi-pause"></i> : 
            <i className="pi pi-play"></i>}
        </button>
        
        <div className="time-display">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
      
      <div className="progress-controls">
        <input
          ref={progressRef}
          type="range"
          min="0"
          max="100"
          value={(currentTime / duration) * 100 || 0}
          onChange={handleProgressChange}
          disabled={!audioLoaded}
          className="progress-slider"
          aria-label="Audio progress"
        />
      </div>
      
      <div className="volume-controls">
        <span className="volume-icon">
          {volume === 0 ? <i className="pi pi-volume-off"></i> :
           volume < 0.5 ? <i className="pi pi-volume-down"></i> :
           <i className="pi pi-volume-up"></i>}
        </span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={handleVolumeChange}
          disabled={!audioLoaded}
          className="volume-slider"
          aria-label="Volume control"
        />
      </div>
    </div>
  );
}
