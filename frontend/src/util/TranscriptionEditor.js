// frontend/src/util/TranscriptionEditor.js
import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import AudioPlayer from '../components/AudioPlayer';
import { useAuth } from '../context/AuthContext';

export default function TranscriptionEditor(){
  const { docId } = useParams();
  const socketRef = useRef(null);
  const [content, setContent] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [audioTrashed, setAudioTrashed] = useState(false);
  const [audioFilename, setAudioFilename] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const { currentUser } = useAuth();

  useEffect(() => {
    // load doc with authentication
    (async () => {
      try {
        // Get authentication token
        const idToken = await currentUser.getIdToken();
        
        const res = await fetch(`/api/docs/${docId}`, {
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'X-User-ID': currentUser.uid
          }
        });
        
        if(res.ok){
          const docData = await res.json();
          setContent(docData.content || '');
          setAudioTrashed(!!docData.audioTrashed);
          setAudioFilename(docData.audioFilename || '');
          setAudioUrl(`/uploads/${docData.audioFilename}`);
        } else {
          const errorData = await res.json();
          console.error("Error loading doc:", errorData.error);
        }
      } catch(err){
        console.error("Error loading doc:", err);
      }
    })();
  }, [docId, currentUser]);

  useEffect(() => {
    // Get authentication token for socket connections
    const setupSocket = async () => {
      try {
        const idToken = await currentUser.getIdToken();
        
        const socket = io();
        socketRef.current = socket;
        
        // Join doc room with authentication
        socket.emit('join_doc', { 
          doc_id: docId,
          user_id: currentUser.uid,
          token: idToken
        });

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
        
        const handleError = (data) => {
          if(data.doc_id === docId){
            console.error("Transcription error:", data.error);
          }
        };

        socket.on('partial_transcript_batch', handlePartial);
        socket.on('final_transcript', handleFinal);
        socket.on('transcription_error', handleError);
        socket.on('doc_access_error', handleError);

        return () => {
          socket.off('partial_transcript_batch', handlePartial);
          socket.off('final_transcript', handleFinal);
          socket.off('transcription_error', handleError);
          socket.off('doc_access_error', handleError);
          socket.disconnect();
        };
      } catch (err) {
        console.error("Socket setup error:", err);
      }
    };
    
    setupSocket();
  }, [docId, currentUser, content]);

  const handleContentChange = async (newContent) => {
    setContent(newContent);
    
    try {
      // Get authentication token
      const idToken = await currentUser.getIdToken();
      
      // Emit socket event with authentication
      if(socketRef.current){
        socketRef.current.emit('edit_doc', { 
          doc_id: docId, 
          content: newContent,
          user_id: currentUser.uid,
          token: idToken
        });
      }
      
      // Also update via REST API for persistence
      await fetch(`/api/docs/${docId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
          'X-User-ID': currentUser.uid
        },
        body: JSON.stringify({ content: newContent })
      });
    } catch (err) {
      console.error("Error updating document:", err);
    }
  };

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
        onChange={handleContentChange}
        style={{ height:'600px', background:'#fff' }}
      />
      {audioUrl && <AudioPlayer audioUrl={audioUrl} filename={audioFilename} />}
    </div>
  );
}
