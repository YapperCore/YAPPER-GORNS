import React, { useState, useEffect } from 'react';
import './TrashBucket.css';
import { Restore } from '../../util/confirmable';

const TrashBucket = () => {
  const [trashFiles, setTrashFiles] = useState([]);

  const handleRestore = async (filename) => {
    try {
        const response = await fetch(`/restore_file/${filename}`, {
            method: 'GET',
        });

        if (response.ok) {
            setTrashFiles((prev) => prev.filter((f) => f !== filename));
        } else {
            const data = await response.json();
            alert(`Error restoring file: ${data.message}`);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error restoring file');
    }
  };

  useEffect(() => {
    const fetchTrash = async () => {
      try {
        const res = await fetch('/trash-files');
        if(res.ok){
          const data = await res.json();
          setTrashFiles(data.files);
        }
      } catch(err){
        console.error("Error fetching trash files:", err);
      }
    };
    fetchTrash();
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
