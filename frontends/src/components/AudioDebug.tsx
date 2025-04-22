import React from 'react';

interface AudioDebugProps {
  filename: string;
  audioUrl?: string;
  error?: string | null;
}

const AudioDebug: React.FC<AudioDebugProps> = ({ filename, audioUrl, error }) => {
  return (
    <div style={{
      margin: "10px 0",
      padding: "10px",
      backgroundColor: "#f8f9fa",
      border: "1px solid #ddd",
      borderRadius: "4px",
      fontSize: "12px"
    }}>
      <h4 style={{ margin: "0 0 8px 0" }}>Audio Debug Info</h4>
      <p><strong>Filename:</strong> {filename || "Not provided"}</p>
      <p><strong>Audio URL:</strong> {audioUrl || "Not provided"}</p>
      <p><strong>Error:</strong> {error || "None"}</p>
      <p><strong>Test audio tag:</strong></p>
      <audio 
        controls 
        src={audioUrl || `/api/audio/${filename}`}
        style={{ width: "100%", marginTop: "5px" }}
      >
        Your browser does not support the audio element.
      </audio>
    </div>
  );
};

export default AudioDebug;
