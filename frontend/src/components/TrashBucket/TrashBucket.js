// frontend/src/components/TrashBucket/TrashBucket.js
import React, { useState, useEffect, useRef } from 'react';
import './TrashBucket.css';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { ConfirmDialog } from 'primereact/confirmdialog';
import { useAuth } from '../../context/AuthContext';

const TrashBucket = () => {
  const [trashFiles, setTrashFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
<<<<<<< HEAD
  const [actionInProgress, setActionInProgress] = useState(false);
=======
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui
  const toast = useRef(null);
  const { currentUser } = useAuth();

  useEffect(() => {
    fetchTrashFiles();
  }, [currentUser]);

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
      } catch (err) {
        console.error("Error fetching trash files:", err);
      }
    };

    fetchTrashFiles();
  }, []);

  const handleRestore = async (filename) => {
<<<<<<< HEAD
    if (!currentUser || actionInProgress) return;
    
    setActionInProgress(true);
=======
    if (!currentUser) return;
    
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui
    try {
      const res = await fetch(`/restore_file/${filename}`, { method: 'GET' });
      if (res.ok) {
        setTrashFiles((prev) => prev.filter((f) => f !== filename));
      } else {
        console.error("Error fetching trash files:", res.statusText);
        showToast('error', 'Error', 'Failed to load trash files');
      }
    } catch (err) {
      console.error("Error restoring file:", err);
      showToast('error', 'Error', 'Failed to restore file');
<<<<<<< HEAD
    } finally {
      setActionInProgress(false);
=======
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui
    }
  };

  const confirmDelete = (filename) => {
<<<<<<< HEAD
    if (actionInProgress) return;
=======
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui
    setFileToDelete(filename);
    setConfirmVisible(true);
  };

  const handlePermDelete = async () => {
<<<<<<< HEAD
    if (!fileToDelete || !currentUser || actionInProgress) return;
    
    setActionInProgress(true);
=======
    if (!fileToDelete || !currentUser) return;
    
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui
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
        showToast('success', 'Deleted', 'File permanently deleted');
      } else {
        let errorMessage = 'Failed to delete file';
        try {
          const data = await res.json();
          errorMessage = data.error || data.message || errorMessage;
        } catch (e) {
          // If the response is not JSON
          errorMessage = `Failed to delete file: ${res.statusText}`;
        }
        showToast('error', 'Error', errorMessage);
      }
    } catch (err) {
      console.error("Error permanently deleting file:", err);
      showToast('error', 'Error', 'Failed to delete file');
    } finally {
      setFileToDelete(null);
      setConfirmVisible(false);
<<<<<<< HEAD
      setActionInProgress(false);
    }
  };

  // Function to retry operations
  const retryOperation = (operation, filename) => {
    if (operation === 'restore') {
      handleRestore(filename);
    } else if (operation === 'delete') {
      confirmDelete(filename);
=======
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui
    }
  };

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
      
<<<<<<< HEAD
      <div className="trash-controls">
        <Button 
          icon="pi pi-refresh" 
          label="Refresh" 
          className="p-button-secondary" 
          onClick={fetchTrashFiles}
          disabled={actionInProgress}
        />
      </div>
      
=======
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui
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
<<<<<<< HEAD
                  disabled={actionInProgress}
=======
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui
                />
                <Button 
                  icon="pi pi-trash" 
                  label="Perm Delete" 
                  className="p-button-danger" 
                  onClick={() => confirmDelete(file)}
<<<<<<< HEAD
                  disabled={actionInProgress}
=======
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TrashBucket;
