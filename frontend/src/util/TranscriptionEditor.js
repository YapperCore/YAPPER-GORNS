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
import { InputTextarea } from 'primereact/inputtextarea';
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
  const [prompt, setPrompt] = useState('');
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [waitingForPrompt, setWaitingForPrompt] = useState(false);
  const [isApiProcessing, setIsApiProcessing] = useState(false);
  const socketRef = useRef(null);
  const toastRef = useRef(null);
  const editorRef = useRef(null);
  
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
          
          // Get transcription prompt if it exists
          setPrompt(doc.transcription_prompt || '');
          
          // Check if this doc is awaiting a prompt (for Replicate)
          if (doc.awaiting_prompt) {
            setWaitingForPrompt(true);
            toastRef.current?.show({
              severity: 'info',
              summary: 'Input Needed',
              detail: 'Please provide a transcription prompt to continue',
              life: 5000
            });
          }
          
          // Check if transcription is already complete
          if (doc.content && doc.content.trim().length > 0) {
            if (doc.content.includes("Transcription complete") || 
                doc.content.length > 100) {
              setIsComplete(true);
              setProgress(100);
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
            
            // Show prompt input if using Replicate
            const usingReplicate = settings.transcriptionConfig.mode === 'replicate';
            setShowPromptInput(usingReplicate);
            
            if (usingReplicate && !doc?.content) {
              toastRef.current?.show({
                severity: 'info',
                summary: 'Using Replicate API',
                detail: 'Transcription will be processed in the cloud. This may take a moment to initialize.',
                life: 5000
              });
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
  }, [docId, currentUser]);
  
  // Socket.IO for real-time updates
  useEffect(() => {
    if (!currentUser) return;
    
    // Use the current host for socket connection to avoid hard-coded IP
    const socketHost = window.location.origin;
    const socket = io(socketHost, {
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });
    
    socketRef.current = socket;
    
    const handleConnect = () => {
      console.log("Socket connected");
      setApiStatus("Socket connected successfully");
      socket.emit('join_doc', { doc_id: docId });
    };
    
    const handleConnectError = (err) => {
      console.error("Socket connection error:", err);
      setError(`Socket connection error: ${err.message}`);
      setApiStatus(`Connection error: ${err.message}`);
    };
    
    const handleDisconnect = (reason) => {
      console.log("Socket disconnected:", reason);
      setApiStatus(`Socket disconnected: ${reason}`);
      
      // Try to reconnect
      setTimeout(() => {
        socket.connect();
      }, 3000);
    };

    socket.on('connect', handleConnect);
    socket.on('connect_error', handleConnectError);
    socket.on('disconnect', handleDisconnect);

    const handlePartialBatch = data => {
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
            if (transcriptionConfig.mode === 'replicate') {
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
      if (data.doc_id === docId && data.done) {
        setIsComplete(true);
        setProgress(100);
        setIsApiProcessing(false);
        
        // Update with final content if provided
        if (data.content) {
          setContent(data.content);
        }
        
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
      if (update.doc_id === docId) {
        setContent(update.content);
      }
    };

    const handleTranscriptionError = data => {
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
    };

    socket.on('partial_transcript_batch', handlePartialBatch);
    socket.on('final_transcript', handleFinal);
    socket.on('doc_content_update', handleDocUpdate);
    socket.on('transcription_error', handleTranscriptionError);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleConnectError);
      socket.off('disconnect', handleDisconnect);
      socket.off('partial_transcript_batch', handlePartialBatch);
      socket.off('final_transcript', handleFinal);
      socket.off('doc_content_update', handleDocUpdate);
      socket.off('transcription_error', handleTranscriptionError);
      socket.disconnect();
    };
  }, [docId, currentUser, transcriptionConfig.mode]);

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
      setError(`Error saving prompt: ${err.message}`);
    }
  };
  
  const submitPrompt = async () => {
    if (!currentUser || !prompt.trim()) return;
    
    try {
      // Save the prompt first
      await savePrompt();
      
      // Clear content and reset progress
      setContent('');
      setProgress(0);
      setIsComplete(false);
      setWaitingForPrompt(false);
      setIsApiProcessing(true);
      setApiStatus("Starting transcription with Replicate API...");
      
      // Tell server to start transcription
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
          detail: 'The Replicate API is processing your audio. This may take a moment...',
          life: 5000
        });
        
        setApiStatus("Transcription job submitted to Replicate. Waiting for processing...");
      } else {
        const data = await response.json();
        setError(`Failed to start transcription: ${data.error || 'Unknown error'}`);
        setIsApiProcessing(false);
        setApiStatus(`Error: ${data.error || 'Unknown error'}`);
        
        toastRef.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: `Failed to start transcription: ${data.error || 'Unknown error'}`,
          life: 5000
        });
      }
    } catch (err) {
      console.error("Error starting transcription:", err);
      setError(`Error starting transcription: ${err.message}`);
      setIsApiProcessing(false);
      setApiStatus(`Error: ${err.message}`);
      
      toastRef.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: `Error starting transcription: ${err.message}`,
        life: 5000
      });
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
        body: JSON.stringify({ transcription_prompt: prompt })
      });
      
      if (response.ok) {
        toastRef.current?.show({
          severity: 'info',
          summary: 'Transcription Started',
          detail: transcriptionConfig.mode === 'replicate' ? 
            'The Replicate API is processing your audio. This may take a moment...' :
            'Transcription has been started. Please wait...',
          life: 5000
        });
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
      {apiStatus && (
        <div style={{ marginBottom: '1rem', padding: '0.5rem', background: '#e8f4fd', borderRadius: '4px', color: '#0c5460' }}>
          <strong>Status:</strong> {apiStatus}
        </div>
      )}
      
      {/* Replicate Loading Animation when processing */}
      {transcriptionConfig.mode === 'replicate' && isApiProcessing && (
        <div style={{ marginBottom: '1rem', padding: '1rem', background: '#fff', borderRadius: '4px', border: '1px solid #ddd', textAlign: 'center' }}>
          <h3>Processing with Replicate API</h3>
          <div style={{ margin: '1rem 0' }}>
            <ProgressBar mode="indeterminate" style={{ height: '6px' }} />
          </div>
          <p>The AI model is processing your audio. This may take a moment if the model needs to start up.</p>
          <p><small>Please wait while we process your transcription...</small></p>
        </div>
      )}
      
      {/* Prompt input for Replicate mode */}
      {showPromptInput && (waitingForPrompt || !content) && (
        <div style={{ marginBottom: '1rem', padding: '1rem', background: '#fff', borderRadius: '4px', border: '1px solid #ddd' }}>
          <h3>Transcription Prompt</h3>
          <p>Enter a prompt to guide the transcription:</p>
          <InputTextarea
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
          <small style={{ marginTop: '0.5rem', display: 'block', color: '#666' }}>
            For Replicate API transcription, you can use a custom prompt to guide the model.
          </small>
        </div>
      )}
      
      {!isComplete && !isApiProcessing && transcriptionConfig.mode !== 'replicate' && (
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
