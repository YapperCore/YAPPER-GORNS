// src/app/home/page.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Toast } from 'primereact/toast';
import { Button } from 'primereact/button';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import Confirmable from '@/components/Confirmable';
import FileUpload from '@/components/FileUpload';
import '@/styles/Home.css';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

interface Document {
  id: string;
  name: string;
  content?: string;
  audioFilename?: string;
  audioTrashed?: boolean;
  deleted?: boolean;
  folderName?: string;
}

export default function Home() {
  const [uploadMessage, setUploadMessage] = useState("");
  const [docs, setDocs] = useState<Document[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState("");
  const [docToMove, setDocToMove] = useState<string | null>(null);
  const [transcriptionPrompt, setTranscriptionPrompt] = useState('');
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false); // Track move dialog open state
  const toast = useRef<Toast>(null);
  const { currentUser } = useAuth();
  const router = useRouter();

  // Fetch data only once when component mounts
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    if (!currentUser) {
      router.push('/login');
      return;
    }
    
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch data in parallel
        await Promise.all([
          fetchDocs(),
          fetchFolders(),
          fetchSettings()
        ]);
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
    
    fetchData();
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
        // Filter out documents that are in trash
        const activeDocs = Array.isArray(data) 
          ? data.filter(doc => !doc.audioTrashed && !doc.deleted)
          : [];
        setDocs(activeDocs);
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
    setIsMoveDialogOpen(true);
  };

  const handleCloseMoveModal = () => {
    setIsMoveDialogOpen(false);
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
        setIsMoveDialogOpen(false);
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

  const handleSuccessfulUpload = () => {
    // Refresh documents after a successful upload
    fetchDocs();
    setUploadMessage("Upload succeeded!");
  };

  if (!currentUser) {
    return null; // Redirecting to login in useEffect
  }

  return (
    <div className="home">
      <Toast ref={toast} position="top-right" />
      
      <div className="home-header">
      <h2 className="text-2xl font-bold">Home</h2>
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

      <div className="docs-section">
        <h3 className="text-2xl font-bold">Document</h3>
        {loading ? (
          <p>Loading documents...</p>
        ) : docs.length === 0 ? (
          <p>No documents available. Upload an audio file to create your first document.</p>
        ) : (
          <div className="docs-grid">
            {docs.map(doc => (
              <div key={doc.id} className="doc-card">
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

      <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
        <DialogContent className="bg-slate-800 text-white p-6 rounded-lxl shadow-2xl border border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Move Document to Folder</DialogTitle>
          </DialogHeader>
          <div className="dialog-body mt-4">
            <select
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              className="w-full p-2 border border-gray-500 rounded-md bg-black text-white"
            >
              <option value="" disabled hidden>Select folder</option>
              {folders.map(folder => (
                <option key={folder} value={folder}>{folder}</option>
              ))}
            </select>
          </div>
          <DialogFooter className="mt-4 flex justify-end">
            <Button
              label="Cancel"
              icon="pi pi-times"
              className="bg-gray-500 text-white hover:bg-gray-600 rounded-xl px-6 py-3"
              onClick={handleCloseMoveModal}
            />
            <Button
              label="Move"
              icon="pi pi-check"
              className="bg-blue-500 text-white hover:bg-blue-600 ml-4 rounded-xl px-6 py-3"
              onClick={handleMoveToFolder}
              disabled={!selectedFolder}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
