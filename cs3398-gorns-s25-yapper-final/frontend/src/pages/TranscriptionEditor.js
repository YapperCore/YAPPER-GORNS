import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

export default function TranscriptionEditor(){
  const { docId } = useParams();
  const [content, setContent] = useState("Loading transcription...");
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(\`/api/docs/\${docId}\`);
        if(r.ok){
          const d = await r.json();
          setContent(d.content || '');
        }
      } catch(err){
        console.error("Error fetching doc:", err);
      }
    })();
  }, [docId]);

  useEffect(() => {
    const s = io();
    setSocket(s);
    s.emit('join_doc', { doc_id: docId });
    const handleUpdate = (data) => {
      if(data.doc_id === docId){
        setContent(data.content);
      }
    };
    s.on('doc_content_update', handleUpdate);
    return () => {
      s.off('doc_content_update', handleUpdate);
      s.disconnect();
    };
  }, [docId]);

  return (
    <div style={{ background: '#333', color: '#fff', minHeight: '100vh', padding: '1rem' }}>
      <h2>Live Transcription</h2>
      <ReactQuill theme="snow" value={content} readOnly style={{ background: '#fff', minHeight: '300px' }} />
    </div>
  );
}
