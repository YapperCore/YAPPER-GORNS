import React from "react";

interface AudioPlayerProps {
  audioUrl: string;
  filename?: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioUrl, filename }) => {
  if (!audioUrl) return null;
  return (
    <div className="audio-player">
      {/* ...existing styling or other elements... */}
      <audio controls src={audioUrl}>
        Your browser does not support the audio element.
      </audio>
      {filename && <p>{filename}</p>}
    </div>
  );
};

export default AudioPlayer;
