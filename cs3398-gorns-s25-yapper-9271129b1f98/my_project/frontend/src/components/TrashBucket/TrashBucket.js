import React, { useState, useEffect } from 'react';
import './TrashBucket.css';
import { Restore } from '../../util/confirmable';

export default function TrashBucket() {
  const [trashFiles, setTrashFiles] = useState([]);

  useEffect(() => {
    fetch('/trash-files')
      .then(r => r.json())
      .then(data => {
        if(data.files) {
          setTrashFiles(data.files);
        }
      })
      .catch(err => console.error("Err fetching trash files:", err));
  }, []);

  const handleRestore = async (filename) => {
    try {
      const res = await fetch(`/restore_file/${filename}`, {
        method: 'GET'
      });
      if(res.ok) {
        setTrashFiles(prev => prev.filter(f => f !== filename));
      } else {
        const data = await res.json();
        alert("Error restoring file: " + data.message);
      }
    } catch(err) {
      console.error("Error restoring file:", err);
    }
  };

  const handlePermDelete = async (filename) => {
    try {
      const res = await fetch(`/permanent_delete/${filename}`, {
        method: 'DELETE'
      });
      if(res.ok) {
        setTrashFiles(prev => prev.filter(f => f !== filename));
      } else {
        const data = await res.json();
        alert("Error deleting file permanently: " + (data.error || data.message));
      }
    } catch(err) {
      console.error("Error perm deleting file:", err);
    }
  };

  return (
    <div className="TrashBucket-container">
      <div className="TrashBucket">
        <h3>Files in Trash:</h3>
        <ul className="trash-list">
          {trashFiles.map((filename, idx) => (
            <li key={idx} className="trash-item">
              <span className="trash-filename">{filename}</span>
              <Restore
                onRestore={() => handleRestore(filename)}
              />
              <button style={{ marginLeft:'8px' }} onClick={() => handlePermDelete(filename)}>
                Perm Delete
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
