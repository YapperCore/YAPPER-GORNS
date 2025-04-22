'use client';

import React, { useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Toast } from 'primereact/toast';
import { ProgressBar } from 'primereact/progressbar';
import { Button } from 'primereact/button';
import '@/styles/FileUpload.css';

interface FileUploadProps {
  onSuccessfulUpload?: (docId: string) => void;
  transcriptionPrompt?: string;
}

export default function FileUpload({ onSuccessfulUpload, transcriptionPrompt = '' }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const { currentUser } = useAuth();
  const toast = useRef<Toast>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file || !currentUser) {
      setError('Please select a file first or log in to upload.');
      toast.current?.show({
        severity: 'error',
        summary: 'Upload Error',
        detail: 'Please select a file first or log in to upload.',
        life: 3000
      });
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      setError('');

      // Simulate progress updates during upload
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return 95;
          }
          return prev + 5;
        });
      }, 300);

      const formData = new FormData();
      formData.append('audio', file);

      // Always ensure there's a prompt, default to "transcribe" if empty
      const finalPrompt = transcriptionPrompt?.trim() || "transcribe";
      formData.append('transcription_prompt', finalPrompt);

      const token = await currentUser.getIdToken();
      
      const response = await fetch('/upload-audio', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      clearInterval(progressInterval);

      if (response.ok) {
        const data = await response.json();
        setUploadProgress(100);
        
        toast.current?.show({
          severity: 'success',
          summary: 'Upload Successful',
          detail: data.message || 'File uploaded successfully',
          life: 3000
        });

        // Reset form
        setFile(null);
        setFileName('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }

        // Call success callback if provided
        if (onSuccessfulUpload && data.doc_id) {
          onSuccessfulUpload(data.doc_id);
        }

        // Open transcription page in new tab
        if (data.doc_id) {
          window.open(`/transcription/${data.doc_id}`, '_blank');
        }
      } else {
        setUploadProgress(0);
        let errorMessage = 'Upload failed';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = `Upload failed: ${response.statusText}`;
        }
        
        setError(errorMessage);
        
        toast.current?.show({
          severity: 'error',
          summary: 'Upload Failed',
          detail: errorMessage,
          life: 3000
        });
      }
    } catch (err: any) {
      setUploadProgress(0);
      const errorMessage = err.message || 'Unknown error occurred';
      setError(`Upload failed: ${errorMessage}`);
      
      toast.current?.show({
        severity: 'error',
        summary: 'Upload Error',
        detail: `Upload failed: ${errorMessage}`,
        life: 3000
      });
      
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      setFileName(droppedFile.name);
      setError('');
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="file-upload-container">
      <Toast ref={toast} position="top-right" />
      
      <div 
        className="dropzone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          className="hidden-input"
        />
        
        <div className="dropzone-content">
          <i className="pi pi-cloud-upload dropzone-icon"></i>
          {fileName ? (
            <p className="selected-file">Selected: {fileName}</p>
          ) : (
            <p>Drag & drop an audio file here, or click to select</p>
          )}
        </div>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      {uploading && (
        <div className="upload-progress">
          <ProgressBar value={uploadProgress} showValue={true} />
          <p>Uploading... {uploadProgress}%</p>
        </div>
      )}
      
      <Button
        label="Upload Audio"
        icon="pi pi-upload"
        className="upload-button"
        onClick={handleUpload}
        disabled={!file || uploading || !currentUser}
        loading={uploading}
      />
    </div>
  );
}
