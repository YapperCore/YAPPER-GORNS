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
<<<<<<< HEAD
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
=======
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui

  // Fetch audio URL only once when component mounts or filename changes
  useEffect(() => {
<<<<<<< HEAD
    let isMounted = true;
    let objectUrl = null;

    async function fetchAudioUrl() {
      if (!filename || !currentUser) return;
      
=======
    // If there's a filename, fetch the raw audio from /local-audio/<filename> as a Blob
    async function fetchLocalAudio() {
      if (!filename || !currentUser) return;
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch(`/local-audio/${filename}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
<<<<<<< HEAD
        
        if (!res.ok) {
          console.error("Failed to fetch audio, status:", res.status);
          return;
        }
        
        // Handle different response types
        const contentType = res.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          // Handle JSON response with URL
          const data = await res.json();
          if (data.url && isMounted) {
            setAudioUrl(data.url);
          }
        } else {
          // Handle direct blob response
          const blob = await res.blob();
          objectUrl = URL.createObjectURL(blob);
          if (isMounted) {
            setAudioUrl(objectUrl);
          }
        }
      } catch (err) {
        console.error("Error fetching audio:", err);
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

  // Set audio source when URL is available
  useEffect(() => {
    if (audioUrl && audioRef.current) {
      // Set the source
      audioRef.current.src = audioUrl;
      
      // Load the audio but don't autoplay
      audioRef.current.load();
    }
  }, [audioUrl]);

  // Set up event listeners
=======
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
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
<<<<<<< HEAD
    const handleLoadedData = () => {
      setDuration(audio.duration);
      setAudioLoaded(true);
    };
    const handleEnded = () => setIsPlaying(false);
    const handleError = (e) => console.error("Audio error:", e);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
=======
    const handleLoadedData = () => setDuration(audio.duration);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadeddata', handleLoadedData);
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadeddata', handleLoadedData);
<<<<<<< HEAD
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
=======
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui
    };
  }, []);

  const handlePlayPause = () => {
<<<<<<< HEAD
    if (!audioRef.current || !audioLoaded) return;
    
=======
    if (!audioRef.current) return;
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui
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
          });
      }
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
<<<<<<< HEAD
    if (!audioRef.current || !audioLoaded) return;
    
=======
    if (!audioRef.current) return;
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui
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
<<<<<<< HEAD
      <audio ref={audioRef} controls={false} preload="metadata" />
      <button 
        onClick={handlePlayPause} 
        disabled={!audioLoaded}
        className={!audioLoaded ? "button-disabled" : ""}
      >
=======
      <audio ref={audioRef} controls={false} />
      <button onClick={handlePlayPause}>
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui
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
      />
      <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
<<<<<<< HEAD
        defaultValue="1"
        onChange={handleVolumeChange}
        disabled={!audioLoaded}
        className={`volume-bar ${!audioLoaded ? "slider-disabled" : ""}`}
=======
        onChange={handleVolumeChange}
        className="volume-bar"
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui
      />
    </div>
  );
}
<<<<<<< HEAD
=======

>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui
