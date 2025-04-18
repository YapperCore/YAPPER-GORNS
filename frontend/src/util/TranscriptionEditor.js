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
import { Button } from 'primereact/button';

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
  const [apiStatus, setApiStatus] = useState('');
  const [processedChunks, setProcessedChunks] = useState([]);
  const [transcriptionConfig, setTranscriptionConfig] = useState({ mode: 'local-cpu' });
  const [isApiProcessing, setIsApiProcessing] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastPollTime, setLastPollTime] = useState(0);
  const socketRef = useRef(null);
  const toastRef = useRef(null);
  const editorRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const pollTimerRef = useRef(null);
  
  // Fetch doc info and user settings
  useEffect(() => {
    async function fetchData() {
      if (!currentUser) return;
      
      try {
        setLoading(true);
        setError('');
        
        const token = await currentUser.getIdToken();
        
        // Fetch doc info
        const docRes = await fetch(`/api/docs/${docId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (docRes.ok) {
          const doc = await docRes.json();
          setContent(doc.content || '');
          setAudioFilename(doc.audioFilename || '');
          setAudioTrashed(!!doc.audioTrashed);
          
          // Check if transcription is already complete
          if (doc.transcription_status === "completed") {
            setIsComplete(true);
            setProgress(100);
            setApiStatus('Transcription completed');
          } else if (doc.content && doc.content.trim().length > 0) {
            if (doc.content.includes("Error:")) {
              setError(doc.content);
              setApiStatus(`Error: ${doc.content}`);
            } else if (doc.content.length > 100) {
              setIsComplete(true);
              setProgress(100);
              setApiStatus('Transcription completed');
            }
          }
        }
        
        // Fetch user settings to check transcription mode
        const settingsRes = await fetch('/api/user-settings', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (settingsRes.ok) {
          const settings = await settingsRes.json();
          if (settings.transcriptionConfig) {
            setTranscriptionConfig(settings.transcriptionConfig);
            
            // If using Replicate, show notification
            if (settings.transcriptionConfig.mode === 'replicate') {
              setApiStatus('Waiting for Replicate API transcription (this may take 30-60 seconds). Please be patient...');
              setIsApiProcessing(true);
              
              // Initial poll for document status
              pollDocumentStatus();
              
              // Set up regular polling as backup
              pollTimerRef.current = setInterval(pollDocumentStatus, 10000);
            }
          }
        }
      } catch (err) {
        console.error("Error loading data:", err);
        setError(`Error loading data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
    
    // Clean up all timers on unmount
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [docId, currentUser]);
  
  // Poll document status as a fallback mechanism
  const pollDocumentStatus = async () => {
    if (!currentUser || Date.now() - lastPollTime < 5000) return;
    
    try {
      setLastPollTime(Date.now());
      const token = await currentUser.getIdToken();
      const response = await fetch(`/api/docs/${docId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const doc = await response.json();
        
        // Only update if there's actual content
        if (doc.content && doc.content !== content) {
          console.log("Polling found updated content:", doc.content);
          setContent(doc.content);
          
          if (doc.transcription_status === "completed") {
            setIsComplete(true);
            setProgress(100);
            setIsApiProcessing(false);
            setApiStatus('Transcription completed successfully via polling');
            
            // Stop polling once we've got the completed document
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            
            toastRef.current?.show({
              severity: 'success',
              summary: 'Transcription Complete',
              detail: 'The audio file has been fully transcribed',
              life: 3000
            });
          } else if (doc.content.includes("Error:")) {
            setError(doc.content);
            setIsApiProcessing(false);
            setApiStatus(`Error detected: ${doc.content}`);
            
            // Stop polling if there's an error
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          }
        }
      }
    } catch (err) {
      console.error("Error polling document status:", err);
    }
  };
  
  // Socket.IO for real-time updates
  useEffect(() => {
    if (!currentUser) return;
    
    const setupSocket = () => {
      // Use the current host for socket connection to avoid hard-coded IP
      const socketHost = window.location.origin;
      const socket = io(socketHost, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000
      });
      
      socketRef.current = socket;
      
      const handleConnect = () => {
        console.log("Socket connected successfully");
        setReconnectAttempts(0);
        setApiStatus(prev => prev + " | Socket connected");
        socket.emit('join_doc', { doc_id: docId });
      };
      
      const handleConnectError = (err) => {
        console.error("Socket connection error:", err);
        setError(`Socket connection error: ${err.message}`);
        setApiStatus(prev => `${prev} | Connection issue: ${err.message}`);
        
        // If we're using Replicate, don't let socket errors disrupt the experience
        // since we'll fall back to polling
        if (transcriptionConfig.mode === 'replicate') {
          if (reconnectAttempts < 5) {
            setReconnectAttempts(prev => prev + 1);
            
            // Try to reconnect after a delay
            reconnectTimerRef.current = setTimeout(() => {
              console.log("Attempting to reconnect socket...");
              if (socketRef.current) {
                socketRef.current.connect();
              }
            }, 3000);
          }
        }
      };
      
      const handleDisconnect = (reason) => {
        console.log("Socket disconnected:", reason);
        setApiStatus(prev => `${prev} | Socket disconnected: ${reason}`);
        
        // Try to reconnect if using Replicate, as connection might be broken during long processing
        if (transcriptionConfig.mode === 'replicate' && !isComplete) {
          reconnectTimerRef.current = setTimeout(() => {
            console.log("Attempting to reconnect after disconnect...");
            if (socketRef.current) {
              socketRef.current.connect();
            }
          }, 3000);
        }
      };

      socket.on('connect', handleConnect);
      socket.on('connect_error', handleConnectError);
      socket.on('disconnect', handleDisconnect);

      const handlePartialBatch = data => {
        console.log("Received partial transcript batch:", data);
        if (data.doc_id === docId) {
          // Mark that API is processing
          setIsApiProcessing(true);
          
          // Update progress directly from server data if available
          if (data.progress !== undefined) {
            setProgress(data.progress);
          }
          
          // Add new chunks to processed chunks list for tracking
          if (data.chunks && data.chunks.length > 0) {
            setProcessedChunks(prev => [...prev, ...data.chunks]);
            
            // Get the text from the chunks
            const chunk_text = data.chunks.map(c => c.text).join(' ');
            
            // Append to content
            setContent(prev => {
              // If this is Replicate API (which sends full content), replace entirely
              if (data.is_replicate) {
                return chunk_text;
              }
              
              // For other modes, append to existing content
              if (!prev) return chunk_text;
              
              const last_char = prev.slice(-1);
              const first_char = chunk_text.charAt(0);
              
              // No space before punctuation
              if (first_char.match(/[.,;:!?'"]/)) {
                return prev + chunk_text;
              } 
              // Add space between words
              else if (last_char.match(/\w/) && first_char.match(/\w/)) {
                return prev + ' ' + chunk_text;
              } 
              // Default append
              else {
                return prev + chunk_text;
              }
            });
          }
        }
      };

      const handleFinal = data => {
        console.log("Received final transcript:", data);
        if (data.doc_id === docId && data.done) {
          setIsComplete(true);
          setProgress(100);
          setIsApiProcessing(false);
          
          // Update with final content if provided
          if (data.content) {
            setContent(data.content);
          }
          
          // Clear all timers as we're done
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          
          toastRef.current?.show({
            severity: 'success',
            summary: 'Transcription Complete',
            detail: 'The audio file has been fully transcribed',
            life: 3000
          });
          
          setApiStatus("Transcription completed successfully");
        }
      };

      const handleDocUpdate = update => {
        console.log("Received doc update:", update);
        if (update.doc_id === docId) {
          setContent(update.content);
        }
      };

      const handleTranscriptionStatus = status => {
        console.log("Received transcription status:", status);
        if (status.doc_id === docId) {
          setApiStatus(status.status);
        }
      };

      const handleTranscriptionError = data => {
        console.log("Received transcription error:", data);
        if (data.doc_id === docId) {
          setIsApiProcessing(false);
          setError(`Transcription error: ${data.error}`);
          setApiStatus(`Error: ${data.error}`);
          
          // Stop polling on error
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          
          toastRef.current?.show({
            severity: 'error',
            summary: 'Transcription Error',
            detail: data.error,
            life: 5000
          });
        }
      };

      socket.on('partial_transcript_batch', handlePartialBatch);
      socket.on('final_transcript', handleFinal);
      socket.on('doc_content_update', handleDocUpdate);
      socket.on('transcription_status', handleTranscriptionStatus);
      socket.on('transcription_error', handleTranscriptionError);

      return () => {
        socket.off('connect', handleConnect);
        socket.off('connect_error', handleConnectError);
        socket.off('disconnect', handleDisconnect);
        socket.off('partial_transcript_batch', handlePartialBatch);
        socket.off('final_transcript', handleFinal);
        socket.off('doc_content_update', handleDocUpdate);
        socket.off('transcription_status', handleTranscriptionStatus);
        socket.off('transcription_error', handleTranscriptionError);
        socket.disconnect();
      };
    };
    
    const cleanup = setupSocket();
    
    return cleanup;
  }, [docId, currentUser, reconnectAttempts, transcriptionConfig.mode, isComplete]);

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
        
        // Also emit changes to other clients if socket is connected
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('edit_doc', { doc_id: docId, content: newContent });
        }
      } catch (err) {
        console.error("Error updating document:", err);
        setError(`Error saving changes: ${err.message}`);
      }
    }
  };

  const startTranscription = async () => {
    if (!currentUser) return;
    
    try {
      // Clear content and reset progress
      setContent('');
      setProgress(0);
      setIsComplete(false);
      setIsApiProcessing(true);
      setApiStatus("Starting transcription...");
      
      // Tell server to start transcription
      const token = await currentUser.getIdToken();
      const response = await fetch(`/api/transcribe/${docId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({})
      });
      
      if (response.ok) {
        toastRef.current?.show({
          severity: 'info',
          summary: 'Transcription Started',
          detail: transcriptionConfig.mode === 'replicate' ? 
            'The Replicate API is processing your audio. This may take 30-60 seconds...' :
            'Transcription has been started. Please wait...',
          life: 5000
        });
        
        // Start polling as a backup
        if (transcriptionConfig.mode === 'replicate') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          pollTimerRef.current = setInterval(pollDocumentStatus, 10000);
        }
      } else {
        const data = await response.json();
        setError(`Failed to start transcription: ${data.error || 'Unknown error'}`);
        setIsApiProcessing(false);
        setApiStatus(`Error: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error("Error starting transcription:", err);
      setError(`Error starting transcription: ${err.message}`);
      setIsApiProcessing(false);
      setApiStatus(`Error: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', background: '#f5f5f5', minHeight: '100vh' }}>
        <h2>Loading Transcription...</h2>
        <div style={{ width: '60%', margin: '2rem auto' }}>
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
      
      {/* API Status Indicator */}
      {transcriptionConfig.mode === 'replicate' && (
        <div style={{ 
          float: 'right', 
          width: '25%', 
          marginBottom: '1rem', 
          padding: '0.5rem', 
          background: '#e8f4fd', 
          borderRadius: '4px', 
          color: '#0c5460',
          fontSize: '0.9rem'
        }}>
          <strong>Using Replicate API</strong>
          <p>Transcription may take 30-60 seconds. Please be patient while the cloud service processes your audio.</p>
          {isApiProcessing && !isComplete && (
            <div style={{ marginTop: '0.5rem' }}>
              <ProgressBar mode="indeterminate" style={{ height: '4px' }} />
            </div>
          )}
          <div style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
            Status: {apiStatus || 'Waiting for processing...'}
          </div>
        </div>
      )}
      
      {!isComplete && !isApiProcessing && transcriptionConfig.mode !== 'replicate' && (
        <div style={{ width: '70%', marginBottom: '1rem' }}>
          <p>Transcription in progress... {progress}% complete</p>
          <ProgressBar value={progress} />
        </div>
      )}

      <ReactQuill
        theme="snow"
        value={content}
        onChange={handleContentChange}
        style={{ height: '600px', background: '#fff', width: '70%', clear: transcriptionConfig.mode === 'replicate' ? 'right' : 'none' }}
        ref={editorRef}
      />
      
      {audioFilename && !audioTrashed && (
        <div style={{ marginTop: '1rem' }}>
          <AudioPlayer filename={audioFilename} />
        </div>
      )}
      
      <div style={{ marginTop: '1rem' }}>
        <Link to="/home">Back to Home</Link>
        {content && isComplete && (
          <div style={{ float: 'right' }}>
            <Button 
              label="Restart Transcription" 
              icon="pi pi-refresh" 
              className="p-button-secondary"
              onClick={startTranscription} 
            />
          </div>
        )}
      </div>
    </div>
  );
}
