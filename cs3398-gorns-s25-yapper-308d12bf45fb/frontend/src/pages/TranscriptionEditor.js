import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';

/**
 * If you want to see doc content live-updated (like a real-time doc).
 */
export default function TranscriptionEditor() {
  const { docId } = useParams();
  const [content, setContent] = useState("Loading content...");

  useEffect(() => {
    const socket = io();
    socket.emit('join_doc', { doc_id: docId });

    socket.on('doc_content_update', data => {
      if(data.doc_id === docId) {
        setContent(data.content);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [docId]);

  return (
    <div style={{ padding:'1rem' }}>
      <h2>Transcription Editor: {docId}</h2>
      <textarea readOnly style={{ width:'100%', height:'300px' }} value={content} />
    </div>
  );
}
