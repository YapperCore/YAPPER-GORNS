import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';

export default function TranscriptionEditor(){
  const { docId } = useParams();
  const [content, setContent] = useState("Loading doc content...");
  const socketRef = useRef(null);

  useEffect(() => {
    // fetch doc content once
    (async () => {
      try {
        const res = await fetch(`/api/docs/${docId}`);
        if(res.ok) {
          const d = await res.json();
          setContent(d.content || '');
        }
      } catch(err) {
        console.error("Doc fetch error:", err);
      }
    })();
  }, [docId]);

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;
    socket.emit('join_doc', { doc_id: docId });

    const handleDocUpdate = data => {
      if(data.doc_id === docId) {
        setContent(data.content);
      }
    };
    socket.on('doc_content_update', handleDocUpdate);

    return () => {
      socket.off('doc_content_update', handleDocUpdate);
      socket.disconnect();
    };
  }, [docId]);

  return (
    <div style={{ padding:'1rem' }}>
      <h2>Transcription Editor: {docId}</h2>
      <textarea readOnly value={content} style={{ width:'100%', height:'300px' }} />
    </div>
  );
}
