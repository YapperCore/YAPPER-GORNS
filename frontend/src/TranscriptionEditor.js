import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

export default function TranscriptionEditor() {
  const { docId } = useParams();
  const socketRef = useRef(null);
  const [content, setContent] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // fetch doc initial content
    (async () => {
      try {
        const res = await fetch(`/api/docs/${docId}`);
        if(res.ok){
          const data = await res.json();
          setContent(data.content || '');
        }
      } catch(err){
        console.error("Error fetching doc:", err);
      }
    })();
  }, [docId]);

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;
    socket.emit('join_doc', { doc_id: docId });

    const handlePartial = (data) => {
      if(data.doc_id === docId){
        let updated = content;
        data.chunks.forEach((ch) => {
          updated += '\n' + ch.text;
        });
        setContent(updated);
      }
    };
    const handleFinal = (data) => {
      if(data.doc_id === docId && data.done){
        setIsComplete(true);
      }
    };
    const handleDocUpdate = (upd) => {
      if(upd.doc_id === docId){
        setContent(upd.content);
      }
    };

    socket.on('partial_transcript_batch', handlePartial);
    socket.on('final_transcript', handleFinal);
    socket.on('doc_content_update', handleDocUpdate);

    return () => {
      socket.off('partial_transcript_batch', handlePartial);
      socket.off('final_transcript', handleFinal);
      socket.off('doc_content_update', handleDocUpdate);
      socket.disconnect();
    };
  }, [docId, content]);

  const handleChange = (val) => {
    setContent(val);
    if(socketRef.current){
      socketRef.current.emit('edit_doc', { doc_id: docId, content: val });
    }
  };

  return (
    <div style={{ background:'#f5f5f5', minHeight:'100vh', padding:'1rem' }}>
      <h2>Transcription for Doc: {docId}</h2>
      {isComplete && <p style={{ color:'green' }}>Transcription Complete!</p>}

      <ReactQuill
        theme="snow"
        value={content}
        onChange={handleChange}
        style={{ height:'600px', background:'#fff' }}
      />
    </div>
  );
}
