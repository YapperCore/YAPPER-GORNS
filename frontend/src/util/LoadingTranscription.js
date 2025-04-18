// src/pages/LoadingTranscription.js
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function LoadingTranscription() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (event) => {
      // Expecting event.data to be an object with the property 'doc_id'
      if (event.data && event.data.doc_id) {
        navigate(`/transcription/${event.data.doc_id}`);
      }
    };
    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
    };
  }, [navigate]);

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Transcription in progress...</h2>
      <p>Your audio is being processed. Please wait for live updates.</p>
    </div>
  );
}

export default LoadingTranscription;

