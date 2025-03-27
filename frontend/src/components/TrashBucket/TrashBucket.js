import React, { useState, useEffect } from 'react';
import './TrashBucket.css';
import { Restore } from '../../util/confirmable';

const TrashBucket = () => {
  const [trashFiles, setTrashFiles] = useState([]);

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

  return (
    <div className="TrashBucket-container">
      <h2>Restore Deleted Files</h2>
      <div className="trash-list">
        {trashFiles.map((file, i) => (
          <div key={i} className="trash-item">
            <h4 className="trash-filename">{file}</h4>
            <div className="trash-actions">
              <Restore onRestore={() => handleRestore(file)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrashBucket;
