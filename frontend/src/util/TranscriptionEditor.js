import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import AudioPlayer from '../components/AudioPlayer';

/**
 * For real-time transcription, single-line chunk usage, doc references an audio file.
 */
export default function TranscriptionEditor(){
  const { docId } = useParams();
  const socketRef = useRef(null);
  const [content, setContent] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [audioTrashed, setAudioTrashed] = useState(false);
  const [audioFilename, setAudioFilename] = useState('');
  const [audioUrl, setAudioUrl] = useState('');

  useEffect(() => {
    // load doc
    (async () => {
      try {
        const res = await fetch(`/api/docs/${docId}`);
        if(res.ok){
          const docData = await res.json();
          setContent(docData.content || '');
          setAudioTrashed(!!docData.audioTrashed);
          setAudioFilename(docData.audioFilename || '');
          setAudioUrl(`/uploads/${docData.audioFilename}`);
        }
      } catch(err){
        console.error("Err loading doc:", err);
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
        data.chunks.forEach(ch => {
          updated += " " + ch.text;
        });
        setContent(updated);
      }
    };
    const handleFinal = (data) => {
      if(data.doc_id === docId && data.done){
        setIsComplete(true);
      }
    };

    socket.on('partial_transcript_batch', handlePartial);
    socket.on('final_transcript', handleFinal);

    return () => {
      socket.off('partial_transcript_batch', handlePartial);
      socket.off('final_transcript', handleFinal);
      socket.disconnect();
    };
  }, [docId, content]);

  return (
    <div style={{ background:'#f5f5f5', minHeight:'100vh', padding:'1rem' }}>
      <h2>Transcription for Doc: {docId}</h2>
      {audioFilename && (
        <p>Audio: {audioFilename}{audioTrashed?' (in TRASH)':''}</p>
      )}
      {isComplete && <p style={{ color:'green' }}>Transcription Complete!</p>}

      <ReactQuill
        theme="snow"
        value={content}
        onChange={setContent}
        style={{ height:'600px', background:'#fff' }}
      />
      {audioUrl && <AudioPlayer audioUrl={audioUrl} filename={audioFilename} />}
    </div>
  );
}
