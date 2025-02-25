import React, { useState, useEffect } from 'react';
import './TrashBucket.css';
import { Restore } from '../../util/confirmable';

const TrashBucket = () => {
  const [trashFiles, setTrashFiles] = useState([]);

  const handleRestore = async (filename) => {
    try {
      const res = await fetch(`/restore_file/${filename}`, { method:'GET' });
      if(res.ok){
        setTrashFiles(prev => prev.filter(f => f !== filename));
        // also any docs referencing that file => audioTrashed = false
      } else {
        const data = await res.json();
        alert("Error restoring file: " + data.message);
      }
    } catch(err){
      console.error("Err restoring file:", err);
    }
  };

  useEffect(() => {
    fetch('/trash-files')
      .then(r => r.json())
      .then(data => setTrashFiles(data.files||[]))
      .catch(err => console.error("trash fetch:", err));
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h3>Trash Bucket</h3>
        <div className="TrashBucket-container">
          <div className="TrashBucket">
            <ul className="trash-list">
              {trashFiles.map((file, i) => (
                <li key={i} className="trash-item">
                  <span className="trash-filename">{file}</span>
                  <Restore onRestore={() => handleRestore(file)} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </header>
    </div>
  );
};

export default TrashBucket;
