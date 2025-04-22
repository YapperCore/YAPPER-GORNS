'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Toast } from 'primereact/toast';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { ProgressBar } from 'primereact/progressbar';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import Confirmable from '@/components/Confirmable';
import FileUpload from '@/components/FileUpload';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
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
  const [folderLoading, setFolderLoading] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [deletingFolder, setDeletingFolder] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState(false);
  const [folderRefreshKey, setFolderRefreshKey] = useState(0);
  const toast = useRef<Toast>(null);
  const { currentUser, logout } = useAuth();
  const router = useRouter();

  // Fetch data on component mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    if (!currentUser) {
      router.push('/login');
      return;
    }
    
    const fetchData = async () => {
      setLoading(true);
      setNetworkError(false);
      
      try {
        // Fetch data in parallel
        await Promise.all([
          fetchDocs(),
          fetchFolders(),
          fetchSettings()
        ]);
      } catch (err) {
        console.error("Error fetching data:", err);
        setNetworkError(true);
        
        toast.current?.show({
          severity: 'error',
          summary: 'Connection Error',
          detail: 'Failed to load data. Please check your network connection.',
          life: 5000
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [currentUser, router]);
  
  // Refresh folders when key changes
  useEffect(() => {
    if (currentUser && folderRefreshKey > 0) {
      fetchFolders();
    }
  }, [currentUser, folderRefreshKey]);

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
      throw err; // Propagate for the parent handler
    }
  };

  const fetchFolders = async () => {
    if (!currentUser) return;
    
    try {
      setFolderLoading(true);
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/folders', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        
        // Handle both format types
        if (data && data.dotFiles) {
          setFolders(Array.isArray(data.dotFiles) ? data.dotFiles : []);
        } else if (Array.isArray(data)) {
          setFolders(data);
        } else {
          console.warn("Unexpected folder data format:", data);
          setFolders([]);
        }
      } else {
        console.error("Error fetching folders:", res.status, res.statusText);
        setFolders([]);
      }
    } catch (err) {
      console.error("Error fetching folders:", err);
      setFolders([]);
      throw err; // Propagate for the parent handler
    } finally {
      setFolderLoading(false);
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
        if (settings.transcriptionConfig) {
          // Check if using Replicate API
          const usingReplicate = settings.transcriptionConfig.mode === 'replicate';
          setShowPromptInput(usingReplicate);
        }
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
    }
  };

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

      if (res.ok) {
        const data = await res.json();
        
        toast.current?.show({ 
          severity: 'success', 
          summary: 'Folder Created', 
          detail: data.message || 'Folder created successfully', 
          life: 3000 
        });
        
        // Refresh folders list
        await fetchFolders();
      } else {
        let errorMessage = 'Failed to create folder';
        try {
          const errData = await res.json();
          errorMessage = errData.error || errorMessage;
        } catch (e) {
          // If response is not valid JSON
        }
        
        toast.current?.show({ 
          severity: 'error', 
          summary: 'Error', 
          detail: errorMessage, 
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
  
  const handleDeleteFolder = async (folderName: string) => {
    if (!currentUser || !folderName) return;
    
    confirmDialog({
      message: `Are you sure you want to delete folder "${folderName}"? Any documents in this folder will be moved to home.`,
      header: 'Delete Folder',
      icon: 'pi pi-exclamation-triangle',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        try {
          setDeletingFolder(folderName);
          const token = await currentUser.getIdToken();
          
          // First get documents in this folder to handle them properly
          const docsRes = await fetch(`/api/folders/${folderName}`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          
          // If we get documents, move them to home first
          if (docsRes.ok) {
            const folderDocs = await docsRes.json();
            
            // Move each document to home
            if (Array.isArray(folderDocs) && folderDocs.length > 0) {
              for (const doc of folderDocs) {
                if (doc.id) {
                  try {
                    await fetch(`/api/folders/home/add/${doc.id}`, {
                      method: 'POST',
                      headers: {
                        Authorization: `Bearer ${token}`
                      }
                    });
                  } catch (err) {
                    console.error(`Error moving doc ${doc.id} to home:`, err);
                  }
                }
              }
            }
          }
          
          // Now delete the folder
          const res = await fetch(`/api/folders/${folderName}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          
          if (res.ok) {
            // Remove from local state for immediate UI update
            setFolders(prev => prev.filter(f => f !== folderName));
            
            toast.current?.show({
              severity: 'success',
              summary: 'Folder Deleted',
              detail: `Folder "${folderName}" has been deleted`,
              life: 3000
            });
            
            // Refetch docs as some might have been moved
            fetchDocs();
          } else {
            try {
              const errData = await res.json();
              toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: errData.error || 'Failed to delete folder',
                life: 3000
              });
            } catch (e) {
              toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: `Failed to delete folder (${res.status})`,
                life: 3000
              });
            }
          }
        } catch (err) {
          console.error("Error deleting folder:", err);
          toast.current?.show({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to delete folder. Please try again.',
            life: 3000
          });
        } finally {
          setDeletingFolder(null);
          // Force a refresh of the folders list
          setFolderRefreshKey(prev => prev + 1);
        }
      }
    });
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
        let errorMessage = 'Failed to delete document';
        try {
          const errData = await res.json();
          errorMessage = errData.error || errorMessage;
        } catch (e) {
          // If response is not valid JSON
        }
        
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: errorMessage,
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
        let errorMessage = 'Failed to move document';
        try {
          const errData = await res.json();
          errorMessage = errData.error || errorMessage;
        } catch (e) {
          // If not parseable JSON
        }
        
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: errorMessage,
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

  const handleSuccessfulUpload = (docId: string) => {
    // Refresh documents after a successful upload
    fetchDocs();
    setUploadMessage("Upload succeeded!");
  };
  
  const handleRetryConnection = () => {
    setNetworkError(false);
    
    // Retry all fetch operations
    Promise.all([
      fetchDocs(),
      fetchFolders(),
      fetchSettings()
    ]).catch(err => {
      console.error("Retry failed:", err);
      setNetworkError(true);
      
      toast.current?.show({
        severity: 'error',
        summary: 'Connection Failed',
        detail: 'Still unable to connect to server. Please check your network.',
        life: 5000
      });
    }).finally(() => {
      setLoading(false);
    });
  };

  if (!currentUser) {
    return null; // Redirecting to login in useEffect
  }

  return (
    <div className="home">
      <Toast ref={toast} position="top-right" />
      <ConfirmDialog />
      
      <div className="home-header">
        <h2>Home - Upload Audio =&gt; Create Doc</h2>
      </div>
      
      {networkError && (
        <div className="network-error-banner">
          <div className="network-error-content">
            <i className="pi pi-exclamation-triangle"></i>
            <span>Unable to connect to server. Please check your network connection.</span>
          </div>
          <Button 
            label="Retry Connection" 
            icon="pi pi-refresh"
            className="p-button-sm"
            onClick={handleRetryConnection}
            disabled={loading}
          />
        </div>
      )}

      <div className="upload section">
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
        {loading || folderLoading ? (
          <div className="loading-container">
            <ProgressBar mode="indeterminate" style={{ height: '6px' }} />
            <p>Loading folders...</p>
          </div>
        ) : folders.length === 0 ? (
          <p>No folders created yet. Create your first folder to organize your documents.</p>
        ) : (
          <div className="docs-grid">
            {folders.map(folder => (
              <div key={folder} className="doc-card folder-card">
                <div className="folder-content" onClick={() => handleFolderClick(folder)}>
                  <h4 className="doc-title">
                    <i className="pi pi-folder"></i> {folder}
                  </h4>
                </div>
                <div className="folder-actions">
                  <button 
                    className="folder-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation(); 
                      handleDeleteFolder(folder);
                    }}
                    title="Delete folder"
                    disabled={deletingFolder === folder}
                  >
                    {deletingFolder === folder ? (
                      <i className="pi pi-spin pi-spinner"></i>
                    ) : (
                      <i className="pi pi-trash"></i>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <hr className="divider" />

      <div className="docs-section">
        <h3 className="text-2xl font-bold">Documents:</h3>
        {loading ? (
          <div className="loading-container">
            <ProgressBar mode="indeterminate" style={{ height: '6px' }} />
            <p>Loading documents...</p>
          </div>
        ) : docs.length === 0 ? (
          <p>No documents available. Upload an audio file to create your first document.</p>
        ) : (
          <div className="docs-grid">
            {docs.map(doc => (
              <div key={doc.id} className="doccard">
                <h4 className="text-2xl font-bold">{doc.name}</h4>
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
                  <Confirmable
                    onDelete={() => handleDelete(doc.id)}
                    toast={toast}
                  />
                  <button
                    onClick={() => handleOpenMoveModal(doc.id)}
                    className="action-link move-link"
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
