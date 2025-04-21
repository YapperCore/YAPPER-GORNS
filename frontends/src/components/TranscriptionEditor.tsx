// src/components/TranscriptionEditor.tsx
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { getSocket, disconnectSocket } from '@/lib/socket';
import AudioPlayer from '@/components/AudioPlayer';
import { useAuth } from '@/context/AuthContext';
import { Toast } from 'primereact/toast';
import { ProgressBar } from 'primereact/progressbar';
import { Button } from 'primereact/button';
import Link from 'next/link';
import Editor from '@/components/Editor';

interface ChunkData {
  chunk_index: number;
  total_chunks: number;
  text: string;
}

export default function TranscriptionEditor() {
  const params = useParams();
  const docId = params.docId as string;
  const { currentUser } = useAuth();
  
  const [content, setContent] = useState<string>('');
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [audioFilename, setAudioFilename] = useState<string>('');
  const [audioTrashed, setAudioTrashed] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [progress, setProgress] = useState<number>(0);
  const [processedChunks, setProcessedChunks] = useState<ChunkData[]>([]);
  const [waitingForPrompt, setWaitingForPrompt] = useState<boolean>(false);
  const [prompt, setPrompt] = useState<string>('');
  const [showPromptInput, setShowPromptInput] = useState<boolean>(false);
  const [apiStatus, setApiStatus] = useState<string>('');
  const [isApiProcessing, setIsApiProcessing] = useState<boolean>(false);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  
  const toastRef = useRef<Toast>(null);
  
  // Fetch document data once on component mount
  useEffect(() => {
    if (typeof window === 'undefined' || !currentUser) return;
    
    const fetchDocData = async () => {
      try {
        setLoading(true);
        const token = await currentUser.getIdToken();
        const res = await fetch(`/api/docs/${docId}`, {
          headers: { 
            Authorization: `Bearer ${token}` 
          }
        });
        
        if (!res.ok) {
          throw new Error(`Failed to fetch document: ${res.status}`);
        }
        
        const doc = await res.json();
        setContent(doc.content || '');
        setAudioFilename(doc.audioFilename || '');
        setAudioTrashed(!!doc.audioTrashed);
        setPrompt(doc.transcription_prompt || '');
        
        if (doc.awaiting_prompt) {
          setWaitingForPrompt(true);
          toastRef.current?.show({
            severity: 'info',
            summary: 'Input Needed',
            detail: 'Please provide a transcription prompt to continue',
            life: 5000
          });
        }
        
        if (doc.content && doc.content.length > 0) {
          if (doc.content.includes("Transcription complete") || doc.content.length > 100) {
            setIsComplete(true);
            setProgress(100);
          }
        }
        
        // Fetch user settings
        try {
          const settingsRes = await fetch('/api/user-settings', {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (settingsRes.ok) {
            const settings = await settingsRes.json();
            if (settings.transcriptionConfig) {
              const usingReplicate = settings.transcriptionConfig.mode === 'replicate';
              setShowPromptInput(usingReplicate);
            }
          }
        } catch (settingsErr) {
          console.error("Error fetching settings:", settingsErr);
          setShowPromptInput(false);
        }
      } catch (err) {
        console.error("Error loading document:", err);
        setError(`Error loading document: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDocData();
    
    // Cleanup function
    return () => {
      disconnectSocket();
    };
  }, [docId, currentUser]);
  
  // Set up socket connection for real-time updates
  useEffect(() => {
    if (typeof window === 'undefined' || !currentUser) return;
    
    try {
      // Initialize socket connection
      const socket = getSocket();
      setSocketConnected(socket.connected);
      
      socket.emit('join_doc', { doc_id: docId });
      
      socket.on('connect', () => {
        console.log('Socket connected');
        setApiStatus('Socket connected successfully');
        setSocketConnected(true);
        socket.emit('join_doc', { doc_id: docId });
      });
      
      socket.on('connect_error', (err) => {
        console.error('Socket connection error:', err);
        setError(`Socket connection error: ${err.message}`);
        setApiStatus(`Connection error: ${err.message}`);
        setSocketConnected(false);
      });
      
      socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        setApiStatus(`Socket disconnected: ${reason}`);
        setSocketConnected(false);
      });
      
      // Set up specific document events
      socket.on('partial_transcript_batch', (data) => {
        if (data.doc_id === docId) {
          setIsApiProcessing(true);
          
          if (data.progress !== undefined) {
            setProgress(data.progress);
          }
          
          if (data.chunks && data.chunks.length > 0) {
            setProcessedChunks(prev => [...prev, ...data.chunks]);
            
            const chunk_text = data.chunks.map((c) => c.text).join(' ');
            
            // Replace content rather than append indefinitely
            if (data.is_replicate || data.mode === 'replicate') {
              setContent(chunk_text);
            } else {
              // Smart content merging
              setContent(prev => {
                if (!prev) return chunk_text;
                
                const last_char = prev.slice(-1);
                const first_char = chunk_text.charAt(0);
                
                if (first_char.match(/[.,;:!?'"]/)) {
                  return prev + chunk_text;
                } 
                else if (last_char.match(/\w/) && first_char.match(/\w/)) {
                  return prev + ' ' + chunk_text;
                } 
                else {
                  return prev + chunk_text;
                }
              });
            }
          }
        }
      });
      
      socket.on('final_transcript', (data) => {
        if (data.doc_id === docId && data.done) {
          setIsComplete(true);
          setProgress(100);
          setIsApiProcessing(false);
          
          if (data.content) {
            setContent(data.content);
          }
          
          toastRef.current?.show({
            severity: 'success',
            summary: 'Transcription Complete',
            detail: 'The audio file has been fully transcribed',
            life: 3000
          });
          
          setApiStatus('Transcription completed successfully');
        }
      });
      
      socket.on('doc_content_update', (update) => {
        if (update.doc_id === docId) {
          setContent(update.content);
        }
      });
      
      socket.on('transcription_error', (data) => {
        if (data.doc_id === docId) {
          setIsApiProcessing(false);
          setError(`Transcription error: ${data.error}`);
          setApiStatus(`Error: ${data.error}`);
          
          toastRef.current?.show({
            severity: 'error',
            summary: 'Transcription Error',
            detail: data.error,
            life: 5000
          });
        }
      });
      
      // Return cleanup function
      return () => {
        socket.off('partial_transcript_batch');
        socket.off('final_transcript');
        socket.off('doc_content_update');
        socket.off('transcription_error');
      };
    } catch (err) {
      console.error("Error setting up socket connection:", err);
      setError(`Socket connection error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return () => {}; // Empty cleanup if setup failed
    }
  }, [docId, currentUser]);

  const handleContentChange = async (newContent) => {
    setContent(newContent);
    
    if (!currentUser) return;
    
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
      
      // Emit to socket if connected
      if (socketConnected) {
        const socket = getSocket();
        socket.emit('edit_doc', { doc_id: docId, content: newContent });
      }
    } catch (err) {
      console.error("Error updating document:", err);
      setError(`Error saving changes: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };
  
  const savePrompt = async () => {
    if (!currentUser) return;
    
    try {
      const token = await currentUser.getIdToken();
      await fetch(`/api/docs/${docId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ transcription_prompt: prompt })
      });
      
      toastRef.current?.show({
        severity: 'success',
        summary: 'Prompt Saved',
        detail: 'Transcription prompt has been saved',
        life: 3000
      });
    } catch (err) {
      console.error("Error saving prompt:", err);
      setError(`Error saving prompt: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };
  
  const submitPrompt = async () => {
    if (!currentUser || !prompt.trim()) return;
    
    try {
      await savePrompt();
      
      setContent('');
      setProgress(0);
      setIsComplete(false);
      setWaitingForPrompt(false);
      setIsApiProcessing(true);
      setApiStatus("Starting transcription with API...");
      
      const token = await currentUser.getIdToken();
      const response = await fetch(`/api/transcribe/${docId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ transcription_prompt: prompt })
      });
      
      if (response.ok) {
        toastRef.current?.show({
          severity: 'info',
          summary: 'Transcription Started',
          detail: 'The API is processing your audio. This may take a moment...',
          life: 5000
        });
      } else {
        const data = await response.json();
        setError(`Failed to start transcription: ${data.error || 'Unknown error'}`);
        setIsApiProcessing(false);
        
        toastRef.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: `Failed to start transcription: ${data.error || 'Unknown error'}`,
          life: 5000
        });
      }
    } catch (err) {
      console.error("Error starting transcription:", err);
      setError(`Error starting transcription: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsApiProcessing(false);
      
      toastRef.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: `Error starting transcription: ${err instanceof Error ? err.message : 'Unknown error'}`,
        life: 5000
      });
    }
  };
  
  const startTranscription = async () => {
    if (!currentUser) return;
    
    try {
      setContent('');
      setProgress(0);
      setIsComplete(false);
      setIsApiProcessing(true);
      setApiStatus("Starting transcription...");
      
      const token = await currentUser.getIdToken();
      const response = await fetch(`/api/transcribe/${docId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ transcription_prompt: prompt })
      });
      
      if (response.ok) {
        toastRef.current?.show({
          severity: 'info',
          summary: 'Transcription Started',
          detail: 'Transcription has been started. Please wait...',
          life: 3000
        });
      } else {
        const data = await response.json();
        setError(`Failed to start transcription: ${data.error || 'Unknown error'}`);
        setIsApiProcessing(false);
      }
    } catch (err) {
      console.error("Error starting transcription:", err);
      setError(`Error starting transcription: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsApiProcessing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', background: '#f5f5f5', minHeight: '100vh' }}>
        <h2>Loading Transcription...</h2>
        <div style={{ width: '60%', margin: '2rem auto' }}>
          <ProgressBar value={50} />
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
      
      {apiStatus && (
        <div style={{ marginBottom: '1rem', padding: '0.5rem', background: '#e8f4fd', borderRadius: '4px', color: '#0c5460' }}>
          <strong>Status:</strong> {apiStatus}
        </div>
      )}
      
      {showPromptInput && (waitingForPrompt || !content) && (
        <div style={{ marginBottom: '1rem', padding: '1rem', background: '#fff', borderRadius: '4px', border: '1px solid #ddd' }}>
          <h3>Transcription Prompt</h3>
          <p>Enter a prompt to guide the transcription:</p>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            style={{ width: '100%', marginBottom: '0.5rem' }}
            placeholder="e.g., Please transcribe this audio file. Pay special attention to technical terms."
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button label="Save Prompt" icon="pi pi-save" onClick={savePrompt} />
            <Button label="Start Transcription" icon="pi pi-play" onClick={submitPrompt} />
          </div>
        </div>
      )}
      
      {!isComplete && !isApiProcessing && (
        <div style={{ marginBottom: '1rem' }}>
          <p>Transcription in progress... {progress}% complete</p>
          <ProgressBar value={progress} />
        </div>
      )}
      
      {isApiProcessing && (
        <div style={{ marginBottom: '1rem', padding: '1rem', background: '#fff', borderRadius: '4px', border: '1px solid #ddd', textAlign: 'center' }}>
          <h3>Processing Audio</h3>
          <div style={{ margin: '1rem 0' }}>
            <ProgressBar value={10} />
          </div>
          <p>Please wait while we process your transcription...</p>
        </div>
      )}

      {/* Use our new Editor component */}
      {typeof window !== 'undefined' && (
        <div className="editor-container">
          <Editor 
            value={content} 
            onChange={handleContentChange}
            height="600px"
          />
        </div>
      )}
      
      {audioFilename && !audioTrashed && (
        <div style={{ marginTop: '1rem' }}>
          <AudioPlayer filename={audioFilename} />
        </div>
      )}
      
      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between' }}>
        <Link href="/home">
          <Button label="Back to Home" icon="pi pi-arrow-left" className="p-button-secondary" />
        </Link>
        
        {content && isComplete && (
          <Button 
            label="Restart Transcription" 
            icon="pi pi-refresh" 
            className="p-button-warning"
            onClick={startTranscription} 
          />
        )}
      </div>
    </div>
  );
}
