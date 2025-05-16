// src/components/FolderDocs.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { Toast } from 'primereact/toast';
import { Button } from 'primereact/button';
import { ConfirmDialog } from 'primereact/confirmdialog';

interface DocInterface {
  id: string;
  name: string;
  content?: string;
  audioFilename?: string;
  audioTrashed?: boolean;
  originalFilename?: string;
  owner?: string;
  firebaseUrl?: string;
  firebasePath?: string;
  localPath?: string;
}

export default function FolderDocs() {
  const params = useParams();
  const folderName = params.folderName as string;
  const { currentUser } = useAuth();
  const [docs, setDocs] = useState<DocInterface[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [confirmDialogVisible, setConfirmDialogVisible] = useState<boolean>(false);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);
  const toast = useRef<Toast>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    async function fetchDocs() {
      if (!currentUser) return;
      
      try {
        setLoading(true);
        const token = await currentUser.getIdToken();
        const res = await fetch(`/api/folders/${folderName}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (!res.ok) {
          throw new Error(`HTTP error! Status: ${res.status}`);
        }
        
        const data = await res.json();
        
        // Handle different response formats
        if (Array.isArray(data)) {
          setDocs(data);
        } else if (data && data.files && Array.isArray(data.files)) {
          setDocs(data.files);
        } else {
          console.warn("Unexpected response format for folder docs:", data);
          setDocs([]);
        }
        
        setError('');
      } catch (err) {
        console.error("Error fetching folder docs:", err);
        setDocs([]);
        setError(`Error loading documents: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoading(false);
      }
    }
    
    fetchDocs();
  }, [currentUser, folderName]);

  const handleMoveToHome = async (docId: string) => {
    if (!currentUser) return;
    
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/folders/home/add/${docId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errData = await res.json();
        console.error('Error moving document to home:', errData.error);
        
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: `Failed to move document: ${errData.error || 'Unknown error'}`,
          life: 3000
        });
      } else {
        // Update local state
        setDocs(prevDocs => prevDocs.filter(doc => doc.id !== docId));
        
        toast.current?.show({
          severity: 'success',
          summary: 'Document Moved',
          detail: 'Document moved to home successfully',
          life: 3000
        });
      }
    } catch (err) {
      console.error('Error moving document to home:', err);
      
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: `Failed to move document: ${err instanceof Error ? err.message : String(err)}`,
        life: 3000
      });
    }
  };

  const confirmDelete = (docId: string) => {
    setDocToDelete(docId);
    setConfirmDialogVisible(true);
  };

  const handleDelete = async () => {
    if (!currentUser || !docToDelete) return;
    
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/docs/${docToDelete}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res.ok) {
        // Update local state
        setDocs(prevDocs => prevDocs.filter(doc => doc.id !== docToDelete));
        
        toast.current?.show({
          severity: 'success',
          summary: 'Document Deleted',
          detail: 'Document deleted successfully',
          life: 3000
        });
      } else {
        const errData = await res.json();
        
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: `Failed to delete document: ${errData.error || 'Unknown error'}`,
          life: 3000
        });
      }
    } catch (err) {
      console.error('Error deleting document:', err);
      
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: `Failed to delete document: ${err instanceof Error ? err.message : String(err)}`,
        life: 3000
      });
    } finally {
      setDocToDelete(null);
      setConfirmDialogVisible(false);
    }
  };

  if (loading) {
    return (
      <div className="folder-docs-container">
        <h2>Loading documents...</h2>
      </div>
    );
  }

  return (
    <div className="home-container">
      <Toast ref={toast} position="top-right" />
      <ConfirmDialog 
        visible={confirmDialogVisible} 
        onHide={() => setConfirmDialogVisible(false)}
        message="Are you sure you want to delete this document?"
        header="Confirm Delete" 
        icon="pi pi-exclamation-triangle"
        accept={handleDelete}
        reject={() => setConfirmDialogVisible(false)}
      />
      
      <h2>Documents in Folder: {folderName}</h2>
      {error && (
        <div style={{ color: 'red', background: '#ffeeee', padding: '0.5rem', borderRadius: '4px', marginBottom: '1rem' }}>
          {error}
        </div>
      )}
      
      {docs.length === 0 ? (
        <p>No documents found in this folder.</p>
      ) : (
        <div className="docs-grid">
          {docs.map(doc => (
            <div key={doc.id} className="doc-card">
              <h4 className="doc-title">{doc.name}</h4>
              {doc.audioFilename && (
                <p className="audio-info">
                  Audio: {doc.audioFilename}
                  {doc.audioTrashed && ' [TRASHED]'}
                </p>
              )}
              <div className="doc-actions">
                <Link
                  href={`/transcription/${doc.id}`}
                  target="_blank"
                  className="action-link transcription-link"
                >
                  View Doc
                </Link>
                <button
                  onClick={() => confirmDelete(doc.id)}
                  className="action-link delete-link"
                >
                  Delete Doc
                </button>
                <button
                  onClick={() => handleMoveToHome(doc.id)}
                  className="action-link move-link orange-button"
                >
                  Move to Home
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div style={{ marginTop: '1rem' }}>
        <Link href="/home">
          <Button label="Back to Home" icon="pi pi-arrow-left" className="p-button-secondary" />
        </Link>
      </div>
    </div>
  );
}
