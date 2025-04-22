// src/pages/UploadAudio.tsx
"use client";

import React, { ChangeEvent, useState } from "react";

const UploadAudio: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string>("");

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert("Please select a file first!");
      return;
    }

    const formData = new FormData();
    formData.append("audio", selectedFile);

    try {
      const response = await fetch("http://localhost:5000/upload-audio", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(`File uploaded successfully: ${data.filename}`);
      } else {
        setMessage(`Upload failed: ${data.error}`);
      }
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    }
  };

  return (
    <div>
      <h2>Upload Audio File</h2>
      <input type="file" accept="audio/*" onChange={handleFileChange} />
      <button onClick={handleUpload}>Upload</button>
      {message && <p>{message}</p>}
    </div>
  );
};

export default UploadAudio;
