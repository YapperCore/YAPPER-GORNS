// src/components/Home.tsx - Updated version
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Toast } from 'primereact/toast';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import Confirmable from '@/components/Confirmable';
import FileUpload from '@/components/FileUpload';
import '@/styles/Home.css';

interface Document {
  id: string;
  name: string;
  content?: string;
  audioFilename?: string;
  audioTrashed?: boolean;
  deleted?: boolean;
  folderName?: string;
}

interface FolderOption {
  label: string;
  value: string;
}

export default function Home() {
  const [uploadMessage, setUploadMessage] = useState("");
  const [docs, setDocs] = useState<Document[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState("");
  const [docToMove, setDocToMove] = useState<string | null>(null);
  const [transcriptionPrompt, setTranscriptionPrompt] = useState('');
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [dataFetched, setDataFetched] = useState(false); // Flag to prevent multiple fetches
  const toast = useRef<Toast>(null);
  const { currentUser, logout } = useAuth();
  const router = useRouter();

  // Single data fetch effect to prevent multiple calls
  useEffect(() => {
    if (typeof window === 'undefined' || !currentUser || dataFetched) return;
    
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchDocs(),
          fetchFolders(),
          fetchSettings()
        ]);
        setDataFetched(true); // Mark data as fetched to prevent repeated calls
      } catch (err) {
        console.error("Error fetching data:", err);
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load data. Please refresh and try again.',
          life: 3000
        });
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [currentUser]); // Only depend on currentUser

  useEffect(() => {
    if (!currentUser && typeof window !== 'undefined') {
      router.push('/login');
    }
  }, [currentUser, router]);

  const fetchDocs = async () => {
    if (!currentUser) return;
    
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/docs', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        setDocs(Array.isArray(data) ? data : []);
      } else {
        console.error("Error fetching docs:", res.status, res.statusText);
        setDocs([]);
        
        if (res.status === 401) {
          // Unauthorized, redirect to login
          router.push('/login');
        }
      }
    } catch (err) {
      console.error("Error fetching docs:", err);
      setDocs([]);
    }
  };

  const fetchFolders = async () => {
    if (!currentUser) return;
    
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/folders', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        
        // Handle different response formats
        if (data && data.dotFiles) {
          setFolders(Array.isArray(data.dotFiles) ? data.dotFiles : []);
        } else if (Array.isArray(data)) {
          setFolders(data);
        } else {
          setFolders([]);
        }
      } else {
        console.error("Error fetching folders:", res.status, res.statusText);
        setFolders([]);
      }
    } catch (err) {
      console.error("Error fetching folders:", err);
      setFolders([]);
    }
  };

  const fetchSettings = async () => {
    if (!currentUser) return;
    
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/user-settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        const settings = await res.json();
        if (settings && settings.transcriptionConfig) {
          // Check if using Replicate API
          const usingReplicate = settings.transcriptionConfig.mode === 'replicate';
          setShowPromptInput(usingReplicate);
        }
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
    }
  };

 // src/components/Home.tsx - Update folder creation functionality
// (Only showing the relevant part that needs changing, not the whole file)

const handleCreateFolder = async () => {
  if (!currentUser || typeof window === 'undefined') return;
  
  const folderName = window.prompt("Enter the name of the folder:");
  if (!folderName || !folderName.trim()) return;
  
  try {
    setCreatingFolder(true);
    
    const token = await currentUser.getIdToken();
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ folderName })
    });
    
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await res.json();
      if (res.ok) {
        toast.current?.show({ 
          severity: 'success', 
          summary: 'Folder Created', 
          detail: data.message || 'Folder created successfully', 
          life: 3000 
        });
        
        // Refresh folders list without triggering full data reload
        await fetchFolders();
      } else {
        toast.current?.show({ 
          severity: 'error', 
          summary: 'Error', 
          detail: data.error || 'Failed to create folder', 
          life: 3000 
        });
      }
    } else {
      toast.current?.show({ 
        severity: 'error', 
        summary: 'Error', 
        detail: 'Unexpected response format', 
        life: 3000 
      });
    }
  } catch (err) {
    console.error("Error creating folder:", err);
    
    toast.current?.show({ 
      severity: 'error', 
      summary: 'Error', 
      detail: 'Failed to create folder. Please try again.', 
      life: 3000 
    });
  } finally {
    setCreatingFolder(false);
  }
}; 
  const handleFolderClick = (folderName: string) => {
    router.push(`/folders/${folderName}`);
  };

  const handleDelete = async (id: string) => {
    if (!currentUser) return;
    
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/docs/${id}`, {
        method: 'DELETE',
        headers: { 
          Authorization: `Bearer ${token}` 
        }
      });
      
      if (res.ok) {
        // Update local state to remove the deleted document
        setDocs(prev => prev.filter(d => d.id !== id));
        
        toast.current?.show({
          severity: 'success',
          summary: 'Document Deleted',
          detail: 'Document moved to trash successfully',
          life: 3000
        });
      } else {
        const errData = await res.json().catch(() => ({ error: 'Failed to delete document' }));
        
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: errData.error || 'Failed to delete document',
          life: 3000
        });
      }
    } catch (err) {
      console.error("Error deleting doc:", err);
      
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to delete document. Please try again.',
        life: 3000
      });
    }
  };

  const handleOpenMoveModal = (docId: string) => {
    setDocToMove(docId);
    setShowMoveModal(true);
  };

  const handleCloseMoveModal = () => {
    setShowMoveModal(false);
    setSelectedFolder("");
    setDocToMove(null);
  };

  const handleMoveToFolder = async () => {
    if (!selectedFolder || !docToMove || !currentUser) {
      toast.current?.show({ 
        severity: 'error', 
        summary: 'Error', 
        detail: 'Please select a folder.', 
        life: 3000 
      });
      return;
    }

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/folders/${selectedFolder}/add/${docToMove}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        
        toast.current?.show({
          severity: 'success',
          summary: 'Document Moved',
          detail: data.message || 'Document moved successfully',
          life: 3000
        });
        
        // Close the modal and reset selection
        setShowMoveModal(false);
        setSelectedFolder("");
        setDocToMove(null);

        // Refresh documents list after moving
        await fetchDocs();
      } else {
        const errData = await res.json().catch(() => ({ error: 'Failed to move document' }));
        
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: errData.error || 'Failed to move document',
          life: 3000
        });
      }
    } catch (err) {
      console.error("Error moving document:", err);
      
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to move document. Please try again.',
        life: 3000
      });
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  const handleSuccessfulUpload = (docId: string) => {
    // Refresh documents after a successful upload
    fetchDocs();
    setUploadMessage("Upload succeeded!");
  };

  if (!currentUser) {
    return null; // Redirecting to login in useEffect
  }

  return (
    <div className="home-container">
      <Toast ref={toast} position="top-right" />
      
      <div className="home-header">
        <h2>Home - Upload Audio =&gt; Create Doc</h2>
        <Button 
          label="Logout" 
          icon="pi pi-sign-out" 
          className="p-button-text" 
          onClick={handleLogout} 
        />
      </div>

      <div className="upload-section">
        {showPromptInput && (
          <div className="prompt-input">
            <p>Using Replicate API: Enter a prompt to guide transcription (optional)</p>
            <textarea
              placeholder="e.g., Please transcribe this audio accurately, paying attention to technical terms."
              value={transcriptionPrompt}
              onChange={(e) => setTranscriptionPrompt(e.target.value)}
              rows={2}
            />
          </div>
        )}
        
        <FileUpload 
          onSuccessfulUpload={handleSuccessfulUpload}
          transcriptionPrompt={transcriptionPrompt}
        />
        
        {uploadMessage && <p className="message">{uploadMessage}</p>}
      </div>

      <hr className="divider" />
      
      <div className="folder-section">
        <Button 
          label="Create Folder" 
          icon="pi pi-folder-plus"
          onClick={handleCreateFolder} 
          className="create-folder-btn"
          disabled={!currentUser || creatingFolder}
          loading={creatingFolder}
        />
      </div>
      
      <hr className="divider" />
      
      <div className="folders-section">
        <h3>Folders:</h3>
        {loading ? (
          <p>Loading folders...</p>
        ) : folders.length === 0 ? (
          <p>No folders created yet. Create your first folder to organize your documents.</p>
        ) : (
          <div className="docs-grid">
            {folders.map(folder => (
              <div key={folder} className="doc-card folder-card" onClick={() => handleFolderClick(folder)}>
                <h4 className="doc-title">
                  <i className="pi pi-folder"></i> {folder}
                </h4>
              </div>
            ))}
          </div>
        )}
      </div>

      <hr className="divider" />

      <div className="docs-section">
        <h3>Docs in Session:</h3>
        {loading ? (
          <p>Loading documents...</p>
        ) : docs.length === 0 ? (
          <p>No documents available. Upload an audio file to create your first document.</p>
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
                  <Link
                    href={`/docs/edit/${doc.id}`}
                    target="_blank"
                    className="action-link edit-link"
                  >
                    Edit Doc
                  </Link>
                  <Confirmable
                    onDelete={() => handleDelete(doc.id)}
                    toast={toast}
                  />
                  <button
                    onClick={() => handleOpenMoveModal(doc.id)}
                    className="action-link move-link orange-button"
                  >
                    Move to Folder
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        header="Move Document to Folder"
        visible={showMoveModal}
        style={{ width: '30vw' }}
        onHide={handleCloseMoveModal}
        footer={
          <div>
            <Button 
              label="Cancel" 
              icon="pi pi-times" 
              className="p-button-text" 
              onClick={handleCloseMoveModal} 
            />
            <Button 
              label="Move" 
              icon="pi pi-check" 
              onClick={handleMoveToFolder} 
              disabled={!selectedFolder}
            />
          </div>
        }
      >
        <div>
          <Dropdown
            value={selectedFolder}
            options={folders.map(folder => ({ label: folder, value: folder }))}
            onChange={(e) => setSelectedFolder(e.value)}
            placeholder="Select a folder"
            className="w-full"
          />
        </div>
      </Dialog>
    </div>
  );
}
