import React, { useEffect, useState } from 'react';
import './TrashBucket.css';
import { Restore, PermDelete } from '../../util/confirmable';

export default function TrashBucket() {
  const [trashFiles, setTrashFiles] = useState([]);

  useEffect(() => {
    fetchTrash();
  }, []);

  const fetchTrash = async () => {
    try {
      const res = await fetch('/trash-files');
      if(res.ok) {
        const data = await res.json();
        setTrashFiles(data.files || []);
      }
    } catch(err) {
      console.error("Error fetching trash files:", err);
    }
  };

  const handleRestore = async (filename) => {
    try {
      const res = await fetch(`/restore_file/${filename}`, {
        method:'GET'
      });
      if(res.ok) {
        setTrashFiles(prev => prev.filter(f => f !== filename));
      } else {
        const d = await res.json();
        alert("Error restoring file: " + d.message);
      }
    } catch(err) {
      console.error("Restore file error:", err);
    }
  };

  const handlePermDelete = async (filename) => {
    try {
      const res = await fetch(`/permanent_delete/${filename}`, {
        method:'DELETE'
      });
      if(res.ok) {
        setTrashFiles(prev => prev.filter(f => f !== filename));
      } else {
        const d = await res.json();
        alert("Error perm deleting file: " + d.message);
      }
    } catch(err) {
      console.error("Perm delete file error:", err);
    }
  };

  return (
    <div className="TrashBucket">
      <h3>Trash Bucket</h3>
      <ul className="trash-list">
        {trashFiles.map((file, idx) => (
          <li key={idx} className="trash-item">
            <span className="trash-filename">{file}</span>
            <Restore onRestore={() => handleRestore(file)} />
            <PermDelete onDelete={() => handlePermDelete(file)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
