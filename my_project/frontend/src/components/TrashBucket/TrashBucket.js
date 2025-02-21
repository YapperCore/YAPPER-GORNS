import React, { useState, useEffect } from 'react';
import './TrashBucket.css';

const TrashBucket = () => {
  const [trashFiles, setTrashFiles] = useState([]);

  useEffect(() => {
    const fetchTrashFiles = async () => {
      try {
        const response = await fetch('/trash-files');
        if (response.ok) {
          const data = await response.json();
          setTrashFiles(data.files);
        } else {
          console.error('Failed to fetch trash files');
        }
      } catch (error) {
        console.error('Error fetching trash files:', error);
      }
    };

    fetchTrashFiles();
  }, []);

  return (
    <div className="TrashBucket">
      <h3>Trash Bucket</h3>
      <ul className="trash-list">
        {trashFiles.map((file, index) => (
          <li key={index} className="trash-item">
            <span className="trash-filename">{file}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TrashBucket;
