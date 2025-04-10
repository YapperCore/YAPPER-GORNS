// src/components/TrashBucket/TrashBucket.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import './TrashBucket.css';
// Import Home.css correctly from the static folder
import '../../static/Home.css'; 
import { Restore, PermDel } from '../../util/confirmable';
import 'primereact/resources/themes/saga-blue/theme.css';
import 'primereact/resources/primereact.min.css';
import { Toast } from 'primereact/toast';
import { ConfirmPopup } from 'primereact/confirmpopup';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../util/api'; // Corrected to api.js instead of apiHelper.js

function TrashBucket() {
  const [trashFiles, setTrashFiles] = useState([]);
  const toast = useRef(null);
  const api = useApi(); // Use the API helper

  // Fetch trash files
  const fetchTrashFiles = useCallback(async () => {
    try {
      const res = await api.get('/trash-files');
      setTrashFiles(res.files || []);
    } catch (err) {
      console.error('Error fetching trash files:', err);
      toast.current?.show({ 
        severity: 'error', 
        summary: 'Error', 
        detail: 'Failed to load trash items', 
        life: 3000 
      });
    }
  }, [api]);

  useEffect(() => {
    fetchTrashFiles();
  }, [fetchTrashFiles]);

  // Handle restore success
  const handleRestoreSuccess = useCallback((filename) => {
    setTrashFiles(prev => prev.filter(f => f !== filename));
    toast.current?.show({ 
      severity: 'success', 
      summary: 'Restored', 
      detail: 'File restored successfully', 
      life: 3000 
    });
  }, []);

  // Handle delete success
  const handleDeleteSuccess = useCallback((filename) => {
    setTrashFiles(prev => prev.filter(f => f !== filename));
    toast.current?.show({ 
      severity: 'success', 
      summary: 'Deleted', 
      detail: 'File permanently deleted', 
      life: 3000 
    });
  }, []);

  const handlePermDelete = async (filename) => {
    try {
      const res = await fetch(`/delete_file/${filename}`, { method: 'DELETE' }); // Changed to DELETE
      if (res.ok) {
        setTrashFiles((prev) => prev.filter((f) => f !== filename));
      } else {
        const data = await res.json();
        alert("Error deleting file: " + data.message);
      }
    } catch (err) {
      console.error("Error deleting file:", err);
    }
  };

  return (
    <div className="TrashBucket-container">
      <Toast ref={toast} position="top-right" />
      <ConfirmPopup />
      
      <h2>Trash Bucket</h2>
      
      <div className="docs-grid">
        {trashFiles.length > 0 ? (
          trashFiles.map((file, i) => (
            <div key={i} className="doc-card">
              <h4 className="doc-title">Trashed file</h4> 
              <p className="audio-info">{file}</p>
              <div className="doc-actions">
                <Restore 
                  filename={file} 
                  onSuccess={() => handleRestoreSuccess(file)} 
                  toast={toast}
                  api={api}
                />
                <PermDel 
                  filename={file} 
                  onSuccess={() => handleDeleteSuccess(file)} 
                  toast={toast}
                  api={api}
                />
              </div>
            </div>
          ))
        ) : (
          <p>Your trash is empty.</p>
        )}
      </div>
    </div>
  );
}

export default TrashBucket;
