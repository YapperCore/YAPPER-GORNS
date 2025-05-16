"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Toast } from 'primereact/toast';
import { Button } from 'primereact/button';
import { ConfirmDialog } from 'primereact/confirmdialog';
import { useRouter } from 'next/navigation';

export default function Trash() {
  const { currentUser } = useAuth();
  const router = useRouter();
  const [trashFiles, setTrashFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [confirmVisible, setConfirmVisible] = useState<boolean>(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<boolean>(false);
  const toast = useRef<Toast>(null);

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!currentUser && typeof window !== 'undefined') {
      router.push('/login');
      return;
    }

    fetchTrashFiles();
  }, [currentUser, router]);

  const fetchTrashFiles = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('/trash-files', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        setTrashFiles(data.files || []);
      } else {
        console.error("Error fetching trash files:", res.statusText);
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load trash files',
          life: 3000
        });
      }
    } catch (err) {
      console.error("Error fetching trash files:", err);
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load trash files',
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (filename: string) => {
    if (!currentUser || actionInProgress) return;
    
    setActionInProgress(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`/restore_file/${filename}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        setTrashFiles(prev => prev.filter(f => f !== filename));
        toast.current?.show({
          severity: 'success',
          summary: 'Restored',
          detail: 'File restored successfully',
          life: 3000
        });
      } else {
        const data = await res.json();
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: `Failed to restore file: ${data.error || data.message || 'Unknown error'}`,
          life: 3000
        });
      }
    } catch (err) {
      console.error("Error restoring file:", err);
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to restore file',
        life: 3000
      });
    } finally {
      setActionInProgress(false);
    }
  };

  const confirmDelete = (filename: string) => {
    if (actionInProgress) return;
    setFileToDelete(filename);
    setConfirmVisible(true);
  };

  const handlePermDelete = async () => {
    if (!fileToDelete || !currentUser || actionInProgress) return;
    
    setActionInProgress(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`/perm_delete_files/${fileToDelete}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        setTrashFiles(prev => prev.filter(f => f !== fileToDelete));
        toast.current?.show({
          severity: 'success',
          summary: 'Deleted',
          detail: 'File permanently deleted',
          life: 3000
        });
      } else {
        let errorMessage = 'Failed to delete file';
        try {
          const data = await res.json();
          errorMessage = data.error || data.message || errorMessage;
        } catch (e) {
          // If the response is not JSON
          errorMessage = `Failed to delete file: ${res.statusText}`;
        }
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: errorMessage,
          life: 3000
        });
      }
    } catch (err) {
      console.error("Error permanently deleting file:", err);
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to delete file',
        life: 3000
      });
    } finally {
      setFileToDelete(null);
      setConfirmVisible(false);
      setActionInProgress(false);
    }
  };

  if (!currentUser) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="TrashBucket-container">
      <Toast ref={toast} position="top-right" />
      <ConfirmDialog
        visible={confirmVisible}
        onHide={() => setConfirmVisible(false)}
        message="Are you sure you want to permanently delete this file? This action cannot be undone."
        header="Confirm Permanent Deletion"
        icon="pi pi-exclamation-triangle"
        accept={handlePermDelete}
        reject={() => setConfirmVisible(false)}
        acceptClassName="p-button-danger"
      />
      
      <h2>Trash Bucket</h2>
      
      <div className="trash-controls">
        <Button 
          icon="pi pi-refresh" 
          label="Refresh" 
          className="p-button-secondary" 
          onClick={fetchTrashFiles}
          disabled={actionInProgress}
        />
      </div>
      
      {loading ? (
        <p>Loading trash files...</p>
      ) : trashFiles.length === 0 ? (
        <p>No files in trash</p>
      ) : (
        <div className="docs-grid">
          {trashFiles.map((file, i) => (
            <div key={i} className="doc-card">
              <h4 className="doc-title">Trashed file</h4> 
              <p className="audio-info">{file}</p>
              <div className="doc-actions">
                <Button 
                  icon="pi pi-undo" 
                  label="Restore" 
                  className="p-button-success" 
                  onClick={() => handleRestore(file)}
                  disabled={actionInProgress}
                />
                <Button 
                  icon="pi pi-trash" 
                  label="Perm Delete" 
                  className="p-button-danger" 
                  onClick={() => confirmDelete(file)}
                  disabled={actionInProgress}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
