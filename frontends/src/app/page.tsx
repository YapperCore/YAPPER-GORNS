"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { InputTextarea } from 'primereact/inputtextarea';
import { ProgressBar } from 'primereact/progressbar';
import { getUserSettings, transcribeAudio, submitTranscriptionPrompt } from '@/services/transcriptionService';

export default function Home() {
  const { currentUser } = useAuth();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>("Click here to select a file");
  const [uploadMessage, setUploadMessage] = useState<string>("");
  const [showPromptInput, setShowPromptInput] = useState<boolean>(false);
  const [transcriptionPrompt, setTranscriptionPrompt] = useState<string>("");
  const [transcriptionConfig, setTranscriptionConfig] = useState<any>({
    mode: 'local-cpu'
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [pendingDocId, setPendingDocId] = useState<string | null>(null);
  const toast = useRef<Toast>(null);

  useEffect(() => {
    if (!currentUser && typeof window !== 'undefined') {
      router.push('/login');
      return;
    }
    
    // Fetch user settings
    async function fetchSettings() {
      if (currentUser) {
        const token = await currentUser.getIdToken();
        const config = await getUserSettings(token);
        if (config) {
          setTranscriptionConfig(config);
          setShowPromptInput(config.mode === 'replicate');
        }
      }
    }
    
    fetchSettings();
  }, [currentUser, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setFileName(f.name);
      setPendingDocId(null); // Reset pending doc when new file is selected
    }
  };

  const handleAudioUpload = async () => {
    if (!file || !currentUser) {
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'No file selected!',
        life: 3000
      });
      return;
    }
    
    setLoading(true);
    try {
      const token = await currentUser.getIdToken();
      const result = await transcribeAudio(file, "", transcriptionPrompt, token, transcriptionConfig);
      
      setUploadMessage(result.message || "Upload succeeded");
      
      // If we got a docId back, either transcription has started or we need a prompt
      if (result.success && result.docId) {
        // If using Replicate and requires prompt
        if (result.message.includes("Provide a prompt") || result.message.includes("after prompt")) {
          setPendingDocId(result.docId);
          toast.current?.show({
            severity: 'info',
            summary: 'Prompt Required',
            detail: 'Please provide a transcription prompt to continue',
            life: 5000
          });
        } else {
          // Open transcription page in a new tab
          window.open(`/transcription/${result.docId}`);
        }
      }
    } catch (err) {
      console.error("Upload error:", err);
      setUploadMessage("Upload failed");
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Upload failed',
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartTranscription = async () => {
    if (!pendingDocId || !currentUser) return;
    
    setLoading(true);
    try {
      const token = await currentUser.getIdToken();
      const result = await submitTranscriptionPrompt(pendingDocId, transcriptionPrompt, token);
      
      if (result.success) {
        setUploadMessage(result.message);
        toast.current?.show({
          severity: 'success',
          summary: 'Transcription Started',
          detail: 'Transcription has been started with Replicate API',
          life: 3000
        });
        
        // Open transcription page in a new tab
        window.open(`/transcription/${pendingDocId}`, '_blank');
        setPendingDocId(null);
      } else {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: result.error || 'Failed to start transcription',
          life: 3000
        });
      }
    } catch (err) {
      console.error("Transcription error:", err);
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to start transcription',
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="home-container">
      <Toast ref={toast} position="top-right" />
      
      <h2>Home - Upload Audio =&gt; Create Doc</h2>
      
      <div className="upload-section">
        {showPromptInput && (
          <div className="prompt-input">
            <p>Using Replicate API: Enter a prompt to guide transcription (optional)</p>
            <InputTextarea
              placeholder="e.g., Please transcribe this audio accurately, paying attention to technical terms."
              value={transcriptionPrompt}
              onChange={(e) => setTranscriptionPrompt(e.target.value)}
              style={{ width: '100%', marginBottom: '10px' }}
              rows={2}
            />
          </div>
        )}
        
        <div
          style={{
            border: '2px dashed #ccc',
            borderRadius: '12px',
            padding: '10px',
            cursor: 'pointer',
            marginBottom: '1rem',
            display: 'inline-block'
          }}
          onClick={() => document.getElementById('fileUpload')?.click()}
        >
          <input
            id="fileUpload"
            type="file"
            style={{ display: 'none' }}
            onChange={handleFileChange}
            accept="audio/*"
          />
          {fileName}
        </div>
        
        <Button
          label={loading ? "Uploading..." : "Submit"}
          icon={loading ? "pi pi-spin pi-spinner" : "pi pi-upload"}
          className="p-button-primary"
          style={{ marginLeft: '1rem' }}
          onClick={handleAudioUpload}
          disabled={loading || !file}
        />
        
        {pendingDocId && (
          <Button
            label="Start Transcription with Prompt"
            icon="pi pi-play"
            className="p-button-success"
            style={{ marginLeft: '1rem' }}
            onClick={handleStartTranscription}
            disabled={loading}
          />
        )}
      </div>
      
      {loading && (
        <div className="indeterminate-progress" style={{ marginTop: '1rem' }}>
          <ProgressBar mode="indeterminate" style={{ height: '6px' }} />
        </div>
      )}
      
      {uploadMessage && <p className="message">{uploadMessage}</p>}
    </div>
  );
}
