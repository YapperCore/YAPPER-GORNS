// src/components/AudioPlayer.js
import React, { useRef, useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './AudioPlayer.css';

export default function AudioPlayer({ filename }) {
  const { currentUser } = useAuth();
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    // If there's a filename, fetch the raw audio from /local-audio/<filename> as a Blob
    async function fetchLocalAudio() {
      if (!filename || !currentUser) return;
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch(`/local-audio/${filename}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
          console.error("Failed to fetch local audio, status:", res.status);
          return;
        }
        const blob = await res.blob();
        // Create an object URL for the blob so <audio> can play it
        const objectUrl = URL.createObjectURL(blob);
        if (audioRef.current) {
          audioRef.current.src = objectUrl;
          audioRef.current.load();
        }
      } catch (err) {
        console.error("Error fetching local audio:", err);
      }
    }
    fetchLocalAudio();
  }, [filename, currentUser]);

  // Listen for time updates
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedData = () => setDuration(audio.duration);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadeddata', handleLoadedData);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadeddata', handleLoadedData);
    };
  }, []);

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play();
      setIsPlaying(true);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleVolumeChange = (e) => {
    if (audioRef.current) {
      audioRef.current.volume = e.target.value;
    }
  };

  const handleProgressChange = (e) => {
    if (!audioRef.current) return;
    const newTime = (e.target.value / 100) * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time) => {
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="audio-player">
      <audio ref={audioRef} controls={false} />
      <button onClick={handlePlayPause}>
        {isPlaying ? '⏸️' : '▶️'}
      </button>
      <input
        type="range"
        min="0"
        max="100"
        value={(currentTime / duration) * 100 || 0}
        onChange={handleProgressChange}
        className="progress-bar"
      />
      <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        onChange={handleVolumeChange}
        className="volume-bar"
      />
    </div>
  );
}

