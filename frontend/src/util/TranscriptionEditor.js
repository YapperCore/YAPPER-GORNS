// frontend/src/util/TranscriptionEditor.js
import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import io from 'socket.io-client';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import AudioPlayer from '../components/AudioPlayer';
import { useAuth } from '../context/AuthContext';
import { Toast } from 'primereact/toast';
import { ProgressBar } from 'primereact/progressbar';

export default function TranscriptionEditor() {
  const { docId } = useParams();
  const { currentUser } = useAuth();
  const [content, setContent] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [audioFilename, setAudioFilename] = useState('');
  const [audioTrashed, setAudioTrashed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
<<<<<<< HEAD
  const [processedChunks, setProcessedChunks] = useState([]);
  const socketRef = useRef(null);
  const toastRef = useRef(null);
  const editorRef = useRef(null);
=======
  const [transcribedChunks, setTranscribedChunks] = useState([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const socketRef = useRef(null);
  const toastRef = useRef(null);
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui
  
  // Fetch doc info
  useEffect(() => {
    const fetchDocInfo = async () => {
      if (!currentUser) return;
      
      try {
        setLoading(true);
        setError('');
        
        const token = await currentUser.getIdToken();
        const res = await fetch(`/api/docs/${docId}`, {
          headers: { 
            Authorization: `Bearer ${token}` 
          }
        });
        
        if (!res.ok) {
          throw new Error(`HTTP error! Status: ${res.status}`);
        }
        
        const doc = await res.json();
        setContent(doc.content || '');
        setAudioFilename(doc.audioFilename || '');
        setAudioTrashed(!!doc.audioTrashed);
        
<<<<<<< HEAD
        // Check if transcription is already complete
        if (doc.content && doc.content.trim().length > 0) {
          if (doc.content.includes("Transcription complete") || 
              doc.content.length > 100) {
            setIsComplete(true);
            setProgress(100);
          }
=======
        if (doc.content && doc.content.trim().length > 0) {
          setIsComplete(true); // Assume transcription is complete if content exists
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui
        }
      } catch (err) {
        console.error("Error loading document:", err);
        setError(`Error loading document: ${err.message}`);
        toastRef.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: `Failed to load document: ${err.message}`,
          life: 3000
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDocInfo();
  }, [docId, currentUser]);

  // Socket.IO for real-time updates
  useEffect(() => {
    const socket = io();
    socketRef.current = socket;
    
    socket.emit('join_doc', { doc_id: docId });

    const handlePartialBatch = data => {
      if (data.doc_id === docId) {
<<<<<<< HEAD
        // Update progress directly from server data if available
        if (data.progress !== undefined) {
          setProgress(data.progress);
        }
        
        // Get the content directly from the server to ensure consistency
        fetchCurrentContent();
        
        // Add new chunks to processed chunks list for tracking
        if (data.chunks && data.chunks.length > 0) {
          setProcessedChunks(prev => [...prev, ...data.chunks]);
          
          // Show notification for new content
          toastRef.current?.show({
            severity: 'info',
            summary: 'New Content',
            detail: `Received new transcription content`,
            life: 1000
          });
        }
=======
        // Update transcribed chunks and progress
        const newChunks = [...transcribedChunks, ...data.chunks];
        setTranscribedChunks(newChunks);
        
        // Set total chunks if this is new info
        if (data.chunks.length > 0 && data.chunks[0].total_chunks > 0) {
          setTotalChunks(data.chunks[0].total_chunks);
        }
        
        // Update progress percentage
        if (totalChunks > 0) {
          const processedIndices = new Set(newChunks.map(c => c.chunk_index));
          const completedChunks = processedIndices.size;
          const newProgress = Math.floor((completedChunks / totalChunks) * 100);
          setProgress(newProgress);
        }
        
        // Update content in editor
        const batchText = data.chunks.map(c => c.text).join(" ");
        setContent(prev => prev + " " + batchText);
        
        // Show notification for new batch
        toastRef.current?.show({
          severity: 'info',
          summary: 'New Transcription Batch',
          detail: `Received ${data.chunks.length} new chunk(s)`,
          life: 1500
        });
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui
      }
    };

    const handleFinal = data => {
      if (data.doc_id === docId && data.done) {
        setIsComplete(true);
        setProgress(100);
        
<<<<<<< HEAD
        // Get final content from server
        fetchCurrentContent();
        
=======
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui
        toastRef.current?.show({
          severity: 'success',
          summary: 'Transcription Complete',
          detail: 'The audio file has been fully transcribed',
          life: 3000
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

    const handleDocUpdate = update => {
      if (update.doc_id === docId) {
        setContent(update.content);
      }
    };

    const handleTranscriptionError = data => {
      if (data.doc_id === docId) {
        setError(`Transcription error: ${data.error}`);
        toastRef.current?.show({
          severity: 'error',
          summary: 'Transcription Error',
          detail: data.error,
          life: 5000
        });
      }
    };

<<<<<<< HEAD
    // Helper function to fetch current content
    const fetchCurrentContent = async () => {
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch(`/api/docs/${docId}`, {
          headers: { 
            Authorization: `Bearer ${token}` 
          }
        });
        
        if (res.ok) {
          const doc = await res.json();
          setContent(doc.content || '');
        }
      } catch (err) {
        console.error("Error fetching current content:", err);
      }
    };

=======
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui
    socket.on('partial_transcript_batch', handlePartialBatch);
    socket.on('final_transcript', handleFinal);
    socket.on('doc_content_update', handleDocUpdate);
    socket.on('transcription_error', handleTranscriptionError);

    return () => {
      socket.off('partial_transcript_batch', handlePartialBatch);
      socket.off('final_transcript', handleFinal);
      socket.off('doc_content_update', handleDocUpdate);
      socket.off('transcription_error', handleTranscriptionError);
      socket.disconnect();
    };
<<<<<<< HEAD
  }, [docId, currentUser]);
=======
  }, [docId, transcribedChunks, totalChunks]);
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui

  const handleContentChange = async (newContent) => {
    setContent(newContent);
    
<<<<<<< HEAD
    // Save changes to the server
=======
    // Update doc on the server
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui
    if (currentUser) {
      try {
        const token = await currentUser.getIdToken();
        await fetch(`/api/docs/${docId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ content: newContent })
        });
<<<<<<< HEAD
        
        // Also emit changes to other clients
        if (socketRef.current) {
          socketRef.current.emit('edit_doc', { doc_id: docId, content: newContent });
        }
=======
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui
      } catch (err) {
        console.error("Error updating document:", err);
        setError(`Error saving changes: ${err.message}`);
      }
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Loading Transcription...</h2>
        <div style={{ width: '60%', margin: '0 auto' }}>
          <ProgressBar value={50} indeterminate={true} />
        </div>
      </div>
    );
  }
<<<<<<< HEAD
=======

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Loading Transcription...</h2>
        <div style={{ width: '60%', margin: '0 auto' }}>
          <ProgressBar value={50} indeterminate={true} />
        </div>
      </div>
    );
  }
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh', padding: '1rem' }}>
      <Toast ref={toastRef} position="top-right" />
      
      <h2>Transcription for Document</h2>
      {error && (
        <div style={{ color: 'red', background: '#ffeeee', padding: '0.5rem', borderRadius: '4px', marginBottom: '1rem' }}>
          {error}
        </div>
      )}
      
      {audioFilename && (
        <p>
          Audio: {audioFilename} 
          {audioTrashed && " (in TRASH)"}
        </p>
      )}
      
      {!isComplete && (
        <div style={{ marginBottom: '1rem' }}>
          <p>Transcription in progress... {progress}% complete</p>
          <ProgressBar value={progress} />
        </div>
      )}

      <ReactQuill
        theme="snow"
        value={content}
        onChange={handleContentChange}
        style={{ height: '600px', background: '#fff' }}
<<<<<<< HEAD
        ref={editorRef}
=======
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui
      />
      
      {audioFilename && !audioTrashed && (
        <div style={{ marginTop: '1rem' }}>
          <AudioPlayer filename={audioFilename} />
        </div>
      )}
      
      <div style={{ marginTop: '1rem' }}>
        <Link to="/home">Back to Home</Link>
      </div>
    </div>
  );
}
