import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
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
  const [processedChunks, setProcessedChunks] = useState([]);
  const socketRef = useRef(null);
  const toastRef = useRef(null);
  const editorRef = useRef(null);
  
  // Fetch doc info
  useEffect(() => {
    (async () => {
      if (!currentUser) return;
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch(`/api/docs/${docId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!res.ok) {
          throw new Error(`HTTP error! Status: ${res.status}`);
        }
        
        const doc = await res.json();
        setContent(doc.content || '');
        setAudioFilename(doc.audioFilename || '');
        setAudioTrashed(!!doc.audioTrashed);
        
        // Check if transcription is already complete
        if (doc.content && doc.content.trim().length > 0) {
          if (doc.content.includes("Transcription complete") || 
              doc.content.length > 100) {
            setIsComplete(true);
            setProgress(100);
          }
        }
      } catch (err) {
        console.error("Error loading doc:", err);
      }
    };

    fetchDocInfo();
  }, [docId, currentUser]);

  // listen for final transcript
  useEffect(() => {
    const socket = io();
    socket.emit('join_doc', { doc_id: docId });

    const handlePartialBatch = data => {
      if (data.doc_id === docId) {
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
      }
    };

    const handleFinal = data => {
      if (data.doc_id === docId && data.done) {
        setContent(data.text || '');
        setIsComplete(true);
        setProgress(100);
        
        // Get final content from server
        fetchCurrentContent();
        
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

    socket.on('partial_transcript_batch', handlePartialBatch);
    socket.on('final_transcript', handleFinal);
    return () => {
      socket.off('final_transcript', handleFinal);
      socket.disconnect();
    };
  }, [docId, currentUser]);

  const handleContentChange = async (newContent) => {
    setContent(newContent);
    
    // Save changes to the server
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
        
        // Also emit changes to other clients
        if (socketRef.current) {
          socketRef.current.emit('edit_doc', { doc_id: docId, content: newContent });
        }
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
      {!isComplete && <p>Transcription in progress...</p>}

      <ReactQuill
        theme="snow"
        value={content}
        onChange={handleContentChange}
        style={{ height: '600px', background: '#fff' }}
        ref={editorRef}
      />
      {audioFilename && !audioTrashed && (
        <AudioPlayer filename={audioFilename} />
      )}
    </div>
  );
}

