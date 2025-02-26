// src/pages/TranscriptionEditor.js
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const TranscriptionEditor = () => {
  const { docId } = useParams();
  const [content, setContent] = useState("Loading transcription...");
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Connect to Socket.IO at the backend URL
    const s = io('http://localhost:5000');
    setSocket(s);

    // Join the room for this document to receive live updates
    s.emit("join_doc", { doc_id: docId });

    // Listen for live updates from the backend
    const handleUpdate = (payload) => {
      if (payload.doc_id === docId) {
        setContent(payload.content);
      }
    };

    s.on("server_doc_update", handleUpdate);

    // Clean up on unmount
    return () => {
      s.off("server_doc_update", handleUpdate);
      s.disconnect();
    };
  }, [docId]);

  return (
    <div style={{ background: '#333', color: '#fff', minHeight: '100vh', padding: '1rem' }}>
      <h2>Live Transcription</h2>
      <ReactQuill
        theme="snow"
        value={content}
        readOnly
        style={{ background: '#fff', minHeight: '300px' }}
      />
    </div>
  );
};

export default TranscriptionEditor;

