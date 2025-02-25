import React, { useState, useEffect } from 'react';
import './TrashBucket.css';
import { Restore, PermDelete } from '../../util/confirmable';

export default function TrashBucket() {
  const [files, setFiles] = useState([]);

  useEffect(() => {
    fetch('/trash-files')
      .then(r => r.json())
      .then(data => {
        if(data.files){
          setFiles(data.files);
        }
      })
      .catch(err => console.error("Error fetching trash files:", err));
  }, []);

  const handleRestore = async (filename) => {
    try {
      const res = await fetch(`/restore_file/${filename}`, { method: 'GET' });
      if (res.ok) {
        setFiles(prev => prev.filter(f => f !== filename));
      } else {
        const d = await res.json();
        alert("Restore error: " + d.message);
      }
    } catch (err) {
      console.error("Restore file error:", err);
    }
  };

  const handlePermDelete = async (filename) => {
    try {
      const res = await fetch(`/permanent_delete/${filename}`, { method: 'DELETE' });
      if (res.ok) {
        setFiles(prev => prev.filter(f => f !== filename));
      } else {
        const d = await res.json();
        alert("Permanent delete error: " + d.message);
      }
    } catch (err) {
      console.error("Permanent delete error:", err);
    }
  };

  return (
    <div className="TrashBucket">
      <h3>Trashed Audio Files</h3>
      <ul className="trash-list">
        {files.map((file, i) => (
          <li key={i} className="trash-item">
            <span className="trash-filename">{file}</span>
            <Restore onRestore={() => handleRestore(file)} />
            <PermDelete onDelete={() => handlePermDelete(file)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
