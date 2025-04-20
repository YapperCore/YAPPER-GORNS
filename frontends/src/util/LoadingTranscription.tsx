// src/pages/LoadingTranscription.tsx
"use client";

import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const LoadingTranscription: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data && typeof event.data === "object" && "doc_id" in event.data) {
        navigate(`/transcription/${event.data.doc_id}`);
      }
    };

    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
    };
  }, [navigate]);

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h2>Transcription in progress...</h2>
      <p>Your audio is being processed. Please wait for live updates.</p>
    </div>
  );
};

export default LoadingTranscription;
