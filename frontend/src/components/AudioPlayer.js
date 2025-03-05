import React, { useRef, useState, useEffect } from 'react';
import './AudioPlayer.css';

const AudioPlayer = ({ audioUrl }) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;

    const updateProgress = () => {
      setCurrentTime(audio.currentTime);
    };

    const setAudioData = () => {
      setDuration(audio.duration);
    };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', setAudioData);

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('loadedmetadata', setAudioData);
    };
  }, []);

  const handlePlayPause = () => {
    if (audioRef.current.paused) {
      audioRef.current.play();
      setIsPlaying(true);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleVolumeChange = (event) => {
    audioRef.current.volume = event.target.value;
  };

  const handleProgressChange = (event) => {
    const newTime = (event.target.value / 100) * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div className="audio-player">
      <audio ref={audioRef} src={audioUrl} controls={false} />
      <button onClick={handlePlayPause}>
        {isPlaying ? '⏸️' : '▶️'}
      </button>
      <input
        type="range"
        min="0"
        max="100"
        value={(currentTime / duration) * 100 || 0}
        onChange={handleProgressChange}
      />
      <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
      <input type="range" min="0" max="1" step="0.01" onChange={handleVolumeChange} />
    </div>
  );
};

export default AudioPlayer;
