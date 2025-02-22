import React, { useState, useEffect } from 'react';
import './TrashBucket.css';
import { Restore } from '../../util/confirmable';
import 'primereact/resources/themes/saga-blue/theme.css';  
import 'primereact/resources/primereact.min.css';          
import 'primeicons/primeicons.css';   

const TrashBucket = () => {
  const [trashFiles, setTrashFiles] = useState([]);

  const handleRestore = async (filename) => {
    try {
        const response = await fetch(`/restore_file/${filename}`, {
            method: 'GET',
        });

        if (response.ok) {
            setTrashFiles((prevFiles) => prevFiles.filter((file) => file !== filename));
        } else {
            const data = await response.json();
            alert(`Error restoring file: ${data.message}`);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while restoring the file');
    }
  };

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
            <Restore onRestore={() => handleRestore(file)} />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TrashBucket;
