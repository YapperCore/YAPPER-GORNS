"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { ProgressBar } from 'primereact/progressbar';
import { InputTextarea } from 'primereact/inputtextarea';
import Link from 'next/link';
import io from 'socket.io-client';

interface Doc {
  id: string;
  name: string;
  content: string;
  audioFilename?: string;
  audioTrashed?: boolean;
  transcription_status?: string;
  is_replicate?: boolean;
}

export default function TranscriptionEditor() {
  const { docId } = useParams();
  const router = useRouter();
  const { currentUser } = useAuth();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [content, setContent] = useState<string>('');
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [usingReplicate, setUsingReplicate] = useState<boolean>(false);
  const socketRef = useRef<any>(null);
  const toast = useRef<Toast>(null);

  useEffect(() => {
    if (!currentUser && typeof window !== 'undefined') {
      router.push('/login');
      return;
    }

    const fetchDoc = async () => {
      try {
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
          setUsingReplicate(!!docData.is_replicate);
          setIsComplete(docData.transcription_status === 'completed');
          
          if (docData.transcription_status === 'completed') {
            setProgress(100);
          }
        } else {
          toast.current?.show({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load document',
            life: 3000
          });
        }
      } catch (error) {
        console.error('Error fetching document:', error);
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

    // Setup Socket.IO for real-time updates
    const socket = io();
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('join_doc', { doc_id: docId });
    });

    socket.on('doc_content_update', (update) => {
      if (update.doc_id === docId) {
        setContent(update.content);
      }
    });

    socket.on('partial_transcript_batch', (data) => {
      if (data.doc_id === docId) {
        setProgress(data.progress || 0);
        
        if (data.is_replicate) {
          // For Replicate, update the entire content
          setContent(data.chunks[0]?.text || '');
        } else {
          // For regular transcription, append chunks
          let updatedContent = content;
          data.chunks.forEach((chunk: any) => {
            if (chunk.text) {
              const textToAdd = chunk.text.trim();
              
              if (updatedContent) {
                const lastChar = updatedContent.slice(-1);
                const firstChar = textToAdd.charAt(0);
                
                if (firstChar.match(/[.,;:!?'"]/)) {
                  updatedContent += textToAdd;
                } else if (lastChar.match(/\w/) && firstChar.match(/\w/)) {
                  updatedContent += ' ' + textToAdd;
                } else {
                  updatedContent += textToAdd;
                }
              } else {
                updatedContent = textToAdd;
              }
            }
          });
          
          setContent(updatedContent);
        }
      }
    });

    socket.on('final_transcript', (data) => {
      if (data.doc_id === docId && data.done) {
        setIsComplete(true);
        setProgress(100);
        
        if (data.content) {
          setContent(data.content);
        }
        
        toast.current?.show({
          severity: 'success',
          summary: 'Transcription Complete',
          detail: 'Audio transcription has been completed',
          life: 3000
        });
      }
    });

    socket.on('transcription_status', (data) => {
      if (data.doc_id === docId) {
        setStatusMessage(data.status || '');
      }
    });

    socket.on('transcription_error', (data) => {
      if (data.doc_id === docId) {
        toast.current?.show({
          severity: 'error',
          summary: 'Transcription Error',
          detail: data.error || 'An error occurred during transcription',
          life: 5000
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [currentUser, docId, router, content]);

  const handleSave = async () => {
    if (!currentUser || !doc) return;
    
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/docs/${docId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: doc.name,
          content: content
        })
      });
      
      if (res.ok) {
        toast.current?.show({
          severity: 'success',
          summary: 'Saved',
          detail: 'Document saved successfully',
          life: 3000
        });
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
    }
  };

  if (!currentUser) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="home-container">
      <Toast ref={toast} position="top-right" />
      
      <h2>Transcription{doc ? `: ${doc.name}` : ''}</h2>
      
      {doc?.audioFilename && (
        <p>
          Audio: {doc.audioFilename}
          {doc.audioTrashed && ' [TRASHED]'}
        </p>
      )}
      
      {loading ? (
        <div className="loading-container">
          <ProgressBar mode="indeterminate" style={{ height: '6px' }} />
          <p>Loading document...</p>
        </div>
      ) : (
        <>
          {!isComplete && (
            <div className="transcription-status">
              <p>Transcription in progress... {progress}% complete</p>
              <ProgressBar value={progress} />
              {statusMessage && (
                <p className="status-message">{statusMessage}</p>
              )}
              {usingReplicate && (
                <p className="replicate-info">
                  Using Replicate API for cloud-based transcription. 
                  This may take a few moments as the model warms up.
                </p>
              )}
            </div>
          )}
          
          <div className="editor-container">
            <InputTextarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={15}
              style={{ width: '100%', marginTop: '1rem' }}
            />
          </div>
          
          <div className="action-buttons" style={{ marginTop: '1rem' }}>
            <Button
              label="Save"
              icon="pi pi-save"
              onClick={handleSave}
              className="p-button-primary"
            />
            
            <Link href="/home">
              <Button
                label="Back to Home"
                icon="pi pi-arrow-left"
                className="p-button-secondary"
                style={{ marginLeft: '1rem' }}
              />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
