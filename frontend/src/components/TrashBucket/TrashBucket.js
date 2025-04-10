import React, { useState, useEffect, useRef } from 'react';
import './TrashBucket.css';
import '../../static/Home.css'; // Reuse the Home.css styles
import { Restore, PermDel } from '../../util/confirmable';
import 'primereact/resources/themes/saga-blue/theme.css'; // Or another PrimeReact theme
import 'primereact/resources/primereact.min.css';
import { Toast } from 'primereact/toast';
import { ConfirmPopup } from 'primereact/confirmpopup';

const TrashBucket = () => {
  const [trashFiles, setTrashFiles] = useState([]);
  const toast = useRef(null); // 👈 One global toast ref

  useEffect(() => {
    const fetchTrashFiles = async () => {
      try {
        const res = await fetch('/trash-files');
        const data = await res.json();
        setTrashFiles(data.files || []);
      } catch (err) {
        console.error("Error fetching trash files:", err);
      }
    };

    fetchTrashFiles();
  }, []);

  const handleRestore = async (filename) => {
    try {
      const res = await fetch(`/restore_file/${filename}`, { method: 'GET' });
      if (res.ok) {
        setTrashFiles((prev) => prev.filter((f) => f !== filename));
      } else {
        const data = await res.json();
        alert("Error restoring file: " + data.message);
      }
    } catch (err) {
      console.error("Error restoring file:", err);
    }
  };

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
        {trashFiles.map((file, i) => (
          <div key={i} className="doc-card">
            <h4 className="doc-title">Trashed file</h4> 
            <p className="audio-info">{file}</p>
            <div className="doc-actions">
              <Restore onRestore={() => handleRestore(file)} toast={toast} />
              <PermDel onDelete={() => handlePermDelete(file)} toast={toast} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrashBucket;
