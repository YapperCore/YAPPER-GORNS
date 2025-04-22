"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Toast } from 'primereact/toast';
import { ProgressBar } from 'primereact/progressbar';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';
import { InputText } from 'primereact/inputtext';
import { Dialog } from 'primereact/dialog';
import { getSocket, joinDocRoom, leaveDocRoom, updateDocContent } from '@/lib/socket-client';
import { useAuth } from '@/context/AuthContext';
import { restartTranscription } from '@/services/transcriptionService';
import AudioPlayer from '@/components/AudioPlayer';
import '@/styles/Transcription.css';

interface Doc {
  id: string;
  name: string;
  content: string;
  audioFilename?: string;
  audioTrashed?: boolean;
  transcription_status?: string;
  is_replicate?: boolean;
  error?: string;
}

export default function TranscriptionEditor() {
  const { docId } = useParams();
  const router = useRouter();
  const { currentUser } = useAuth();
  
  const [doc, setDoc] = useState<Doc | null>(null);
  const [content, setContent] = useState<string>('');
  const [docName, setDocName] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [isReplicate, setIsReplicate] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [showPromptDialog, setShowPromptDialog] = useState<boolean>(false);
  const [transcriptionPrompt, setTranscriptionPrompt] = useState<string>('');
  const [isPromptSubmitting, setIsPromptSubmitting] = useState<boolean>(false);
  
  const toast = useRef<Toast>(null);
  const contentRef = useRef<string>('');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (!currentUser && typeof window !== 'undefined') {
      router.push('/login');
      return;
    }

    const fetchDoc = async () => {
      try {
        setLoading(true);
        if (!currentUser) {
          console.error("User not authenticated");
          setError("You must be logged in to view this transcription");
          setLoading(false);
          return;
        }
        const token = await currentUser.getIdToken();
        const res = await fetch(`/api/docs/${docId}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (res.ok) {
          const docData = await res.json();
          setDoc(docData);
          setContent(docData.content || '');
          contentRef.current = docData.content || '';
          setDocName(docData.name || '');
          setIsReplicate(!!docData.is_replicate);
          
          if (docData.transcription_status === 'completed') {
            setIsComplete(true);
            setProgress(100);
          } else if (docData.transcription_status === 'in_progress') {
            setIsComplete(false);
            setProgress(docData.progress || 30);
          } else if (docData.transcription_status === 'failed') {
            setIsComplete(true);
            setProgress(0);
            setError(docData.error || 'Transcription failed');
            
            toast.current?.show({
              severity: 'error',
              summary: 'Transcription Failed',
              detail: docData.error || 'Transcription failed for unknown reasons',
              life: 5000
            });
          }
        } else {
          const errorData = await res.json();
          setError(errorData.error || 'Failed to load document');
          
          toast.current?.show({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load document',
            life: 3000
          });
        }
      } catch (error) {
        console.error('Error fetching document:', error);
        setError('Error loading document data');
        
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: 'Error loading document data',
          life: 3000
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDoc();
  }, [currentUser, docId, router]);

  useEffect(() => {
    if (!currentUser || !docId || typeof window === 'undefined') return;
    
    try {
      joinDocRoom(docId as string);
      
      const socket = getSocket();
      setSocketConnected(socket.connected);
      
      const handleConnect = () => {
        setSocketConnected(true);
        joinDocRoom(docId as string);
      };
      
      const handleDisconnect = () => {
        setSocketConnected(false);
      };
      
      const handlePartialBatch = (data: any) => {
        if (data.doc_id === docId) {
          if (data.progress !== undefined) {
            setProgress(data.progress);
          }
          
          if (data.is_replicate && data.chunks && data.chunks.length > 0) {
            const newText = data.chunks[0]?.text || '';
            if (newText) {
              setContent(newText);
              contentRef.current = newText;
            }
          } else if (data.chunks && data.chunks.length > 0) {
            let updatedContent = contentRef.current;
            
            data.chunks.forEach((chunk: any) => {
              if (!chunk.text) return;
              
              const chunkText = chunk.text.trim();
              if (!chunkText) return;
              
              if (updatedContent) {
                const lastChar = updatedContent.slice(-1);
                const firstChar = chunkText.charAt(0);
                
                if (firstChar.match(/[.,;:!?'"]/)) {
                  updatedContent += chunkText;
                } else if (lastChar.match(/\w/) && firstChar.match(/\w/)) {
                  updatedContent += ' ' + chunkText;
                } else {
                  updatedContent += chunkText;
                }
              } else {
                updatedContent = chunkText;
              }
            });
            
            setContent(updatedContent);
            contentRef.current = updatedContent;
          }
        }
      };
      
      const handleFinal = (data: any) => {
        if (data.doc_id === docId && data.done) {
          setIsComplete(true);
          setProgress(100);
          
          if (data.content) {
            setContent(data.content);
            contentRef.current = data.content;
          }
          
          toast.current?.show({
            severity: 'success',
            summary: 'Transcription Complete',
            detail: 'Audio transcription has been completed',
            life: 3000
          });
        }
      };
      
      const handleStatus = (data: any) => {
        if (data.doc_id === docId) {
          setStatusMessage(data.status || '');
        }
      };
      
      const handleDocContentUpdate = (data: any) => {
        if (data.doc_id === docId) {
          if (!isSaving) {
            setContent(data.content);
            contentRef.current = data.content;
          }
        }
      };
      
      const handleTranscriptionError = (data: any) => {
        if (data.doc_id === docId) {
          setError(`Transcription error: ${data.error}`);
          setIsComplete(true);
          
          toast.current?.show({
            severity: 'error',
            summary: 'Transcription Error',
            detail: data.error || 'An error occurred during transcription',
            life: 5000
          });
        }
      };
      
      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('partial_transcript_batch', handlePartialBatch);
      socket.on('final_transcript', handleFinal);
      socket.on('transcription_status', handleStatus);
      socket.on('doc_content_update', handleDocContentUpdate);
      socket.on('transcription_error', handleTranscriptionError);
      
      return () => {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('partial_transcript_batch', handlePartialBatch);
        socket.off('final_transcript', handleFinal);
        socket.off('transcription_status', handleStatus);
        socket.off('doc_content_update', handleDocContentUpdate);
        socket.off('transcription_error', handleTranscriptionError);
        leaveDocRoom(docId as string);
      };
    } catch (error) {
      console.error("Error connecting to socket:", error);
      setError("Could not connect to real-time updates. Please reload the page.");
    }
  }, [currentUser, docId, router, isSaving]);

  const saveDocument = async (newContent: string, saveName = false) => {
    if (!currentUser || !doc) return;
    
    try {
      setIsSaving(true);
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/docs/${docId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: saveName ? docName : doc.name,
          content: newContent
        })
      });
      
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
        
        if (socketConnected) {
          updateDocContent(docId as string, newContent);
        }
      } else {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to save document',
          life: 3000
        });
      }
    } catch (error) {
      console.error('Error saving document:', error);
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Error saving document',
        life: 3000
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    contentRef.current = newContent;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveDocument(newContent);
    }, 1000);
  };

  const handleNameChange = (newName: string) => {
    setDocName(newName);
  };

  const saveDocName = () => {
    if (docName.trim() !== doc?.name) {
      saveDocument(content, true);
    }
    setIsEditingName(false);
  };

  const startEditingName = () => {
    setIsEditingName(true);
  };

  const handlePromptSubmit = async () => {
    if (!currentUser || !docId) return;
    
    try {
      setIsPromptSubmitting(true);
      const token = await currentUser.getIdToken();
      const result = await restartTranscription(docId as string, transcriptionPrompt, token);
      
      if (result.success) {
        setShowPromptDialog(false);
        setIsComplete(false);
        setProgress(10);
        
        toast.current?.show({
          severity: 'success',
          summary: 'Transcription Started',
          detail: 'Transcription has been started with your prompt',
          life: 3000
        });
      } else {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: result.error || 'Failed to start transcription',
          life: 3000
        });
      }
    } catch (error) {
      console.error('Error submitting transcription prompt:', error);
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Error submitting transcription prompt',
        life: 3000
      });
    } finally {
      setIsPromptSubmitting(false);
    }
  };

  const handleRestartTranscription = () => {
    if (isReplicate) {
      setShowPromptDialog(true);
      setTranscriptionPrompt('');
    } else {
      restartWithoutPrompt();
    }
  };

  const restartWithoutPrompt = async () => {
    if (!currentUser || !docId) return;
    
    try {
      const token = await currentUser.getIdToken();
      const result = await restartTranscription(docId as string, '', token);
      
      if (result.success) {
        setIsComplete(false);
        setProgress(10);
        setContent('');
        contentRef.current = '';
        
        toast.current?.show({
          severity: 'success',
          summary: 'Transcription Restarted',
          detail: 'Transcription has been restarted',
          life: 3000
        });
      } else {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: result.error || 'Failed to restart transcription',
          life: 3000
        });
      }
    } catch (error) {
      console.error('Error restarting transcription:', error);
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Error restarting transcription',
        life: 3000
      });
    }
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div className="transcription-container">
      <Toast ref={toast} position="top-right" />
      
      <div className="transcription-header">
        {isEditingName ? (
          <div className="edit-name-container">
            <InputText
              value={docName}
              onChange={(e) => handleNameChange(e.target.value)}
              onBlur={saveDocName}
              onKeyDown={(e) => e.key === 'Enter' && saveDocName()}
              autoFocus
              className="w-full"
            />
            <Button
              icon="pi pi-check"
              className="p-button-rounded p-button-text"
              onClick={saveDocName}
              tooltip="Save name"
            />
          </div>
        ) : (
          <h1 className="doc-title" onClick={startEditingName}>
            {doc?.name || 'Loading...'}
            <Button
              icon="pi pi-pencil"
              className="p-button-rounded p-button-text p-button-sm ml-2"
              onClick={startEditingName}
              tooltip="Edit name"
            />
          </h1>
        )}
        
        <div className={`socket-status ${socketConnected ? 'connected' : 'disconnected'}`}>
          {socketConnected ? 'Connected' : 'Offline'}
        </div>
      </div>
      
      {doc?.audioFilename && (
        <div className="audio-info">
          <i className="pi pi-file-audio mr-2"></i> 
          Audio: {doc.audioFilename}
          {doc.audioTrashed && <span className="trashed-badge ml-2">TRASHED</span>}
        </div>
      )}
      
      {error && (
        <div className="error-message">
          <i className="pi pi-exclamation-triangle mr-2"></i> {error}
        </div>
      )}
      
      {!isComplete && (
        <div className="progress-container">
          <div className="processing-indicator">
            <h3>Transcription in progress... {progress}% complete</h3>
            {statusMessage && <div className="status-message">{statusMessage}</div>}
          </div>
          <ProgressBar value={progress} className="transcription-progress-bar" />
          
          {isReplicate && (
            <div className="replicate-info">
              <i className="pi pi-cloud mr-2"></i> Using Replicate API for cloud-based transcription. 
              This may take a few minutes to complete.
            </div>
          )}
        </div>
      )}
      
      {loading ? (
        <div className="loading-container">
          <ProgressBar mode="indeterminate" style={{ height: '6px', width: '50%' }} />
          <p>Loading document...</p>
        </div>
      ) : (
        <div className="main-content">
          <div className="editor-container">
            <InputTextarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              rows={15}
              className="w-full"
              placeholder="Transcription will appear here..."
            />
            
            {saveSuccess && (
              <div className="save-indicator">
                <i className="pi pi-check mr-1"></i> Saved
              </div>
            )}
          </div>
          
          {doc?.audioFilename && !doc.audioTrashed && (
            <div className="audio-player-container">
              <h3>Audio Player</h3>
              <AudioPlayer filename={doc.audioFilename} />
            </div>
          )}
        </div>
      )}
      
      <div className="actions-container">
        <Link href="/home">
          <Button
            label="Back to Home"
            icon="pi pi-arrow-left"
            className="p-button-secondary"
          />
        </Link>
        
        <Button
          label="Save"
          icon="pi pi-save"
          onClick={() => saveDocument(content)}
          loading={isSaving}
          className="p-button-primary"
        />
        
        {isComplete && (
          <Button 
            label="Restart Transcription" 
            icon="pi pi-refresh" 
            className="p-button-warning"
            onClick={handleRestartTranscription}
          />
        )}
      </div>
      
      <Dialog
        header="Enter Transcription Prompt"
        visible={showPromptDialog}
        style={{ width: '50vw' }}
        onHide={() => setShowPromptDialog(false)}
        footer={
          <>
            <Button
              label="Skip Prompt"
              icon="pi pi-times"
              className="p-button-text"
              onClick={restartWithoutPrompt}
            />
            <Button
              label="Start Transcription"
              icon="pi pi-check"
              onClick={handlePromptSubmit}
              loading={isPromptSubmitting}
              disabled={isPromptSubmitting}
            />
          </>
        }
      >
        <p>
          Enter a prompt to guide the Replicate AI transcription. A good prompt can improve accuracy
          for domain-specific content, accents, or technical terminology.
        </p>
        <div className="prompt-input-container mt-3">
          <InputTextarea
            value={transcriptionPrompt}
            onChange={(e) => setTranscriptionPrompt(e.target.value)}
            rows={4}
            className="w-full"
            placeholder="e.g., This is a medical lecture about cardiology with some technical terms. The speaker has a British accent."
          />
        </div>
      </Dialog>
    </div>
  );
}
