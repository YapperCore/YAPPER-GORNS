import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import AudioPlayer from '../components/AudioPlayer';
import { useAuth } from '../context/AuthContext';

export default function TranscriptionEditor() {
  const { docId } = useParams();
  const { currentUser } = useAuth();
  const [content, setContent] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [audioFilename, setAudioFilename] = useState('');
  const [audioTrashed, setAudioTrashed] = useState(false);

  // fetch doc info
  useEffect(() => {
    (async () => {
      if (!currentUser) return;
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch(`/api/docs/${docId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const d = await res.json();
          setContent(d.content || '');
          setAudioFilename(d.audioFilename || '');
          setAudioTrashed(!!d.audioTrashed);
        } else {
          console.error("Doc fetch failed:", res.statusText);
        }
      } catch (err) {
        console.error("Error loading doc:", err);
      }
    })();
  }, [docId, currentUser]);

  // listen for final transcript
  useEffect(() => {
    const socket = io();
    socket.emit('join_doc', { doc_id: docId });

    const handleFinal = data => {
      if (data.doc_id === docId && data.done) {
        setContent(data.text || '');
        setIsComplete(true);
      }
    };

    socket.on('final_transcript', handleFinal);
    return () => {
      socket.off('final_transcript', handleFinal);
      socket.disconnect();
    };
  }, [docId]);

  return (
    <div style={{ background:'#f5f5f5', minHeight:'100vh', padding:'1rem' }}>
      <h2>Transcription for Doc: {docId}</h2>
      {audioFilename && (
        <p>
          Audio: {audioFilename} 
          {audioTrashed && " (in TRASH)"}
        </p>
      )}
      {!isComplete && <p>Transcription in progress...</p>}

      <ReactQuill
        theme="snow"
        value={content}
        onChange={setContent}
        style={{ height:'600px', background:'#fff' }}
      />
      {audioFilename && !audioTrashed && (
        <AudioPlayer filename={audioFilename} />
      )}
    </div>
  );
}

