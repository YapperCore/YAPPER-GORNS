// src/components/Home.tsx - Updated to handle API endpoint issues
"use client";

import React, { useState, useEffect, useRef } from "react";
import { Toast } from "primereact/toast";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Confirmable from "@/components/Confirmable";
import FileUpload from "@/components/FileUpload";
import "@/styles/Home.css";

interface Document {
  id: string;
  name: string;
  content?: string;
  audioFilename?: string;
  audioTrashed?: boolean;
  deleted?: boolean;
  folderName?: string;
}

export default function Home() {
  const [uploadMessage, setUploadMessage] = useState("");
  const [docs, setDocs] = useState<Document[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState("");
  const [docToMove, setDocToMove] = useState<string | null>(null);
  const [transcriptionPrompt, setTranscriptionPrompt] = useState("");
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const toast = useRef<Toast>(null);
  const { currentUser, logout } = useAuth();
  const router = useRouter();

  // Check if we're in a development environment
  const isDev = process.env.NODE_ENV === "development";
  // Base API URL - use proxy in package.json in dev, or actual server in production
  const API_BASE = isDev ? "" : process.env.NEXT_PUBLIC_API_URL || "";

  useEffect(() => {
    if (!currentUser && typeof window !== "undefined") {
      router.push("/login");
      return;
    }

    if (currentUser) {
      Promise.all([fetchDocs(), fetchFolders(), fetchSettings()]).finally(() =>
        setLoading(false)
      );
    }
  }, [currentUser]);

  const fetchDocs = async () => {
    if (!currentUser) return;

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${API_BASE}/api/docs`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setDocs(Array.isArray(data) ? data : []);
        setApiError(null);
      } else {
        console.error("Error fetching docs:", res.status, res.statusText);
        setDocs([]);

        if (res.status === 401) {
          router.push("/login");
        } else if (res.status === 404) {
          setApiError("API endpoint not found. Check server connection.");
        }
      }
    } catch (err) {
      console.error("Error fetching docs:", err);
      setDocs([]);
      setApiError("Failed to connect to the API. Check server connection.");
    }
  };

  const fetchFolders = async () => {
    if (!currentUser) return;

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${API_BASE}/api/folders`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.dotFiles) {
          setFolders(Array.isArray(data.dotFiles) ? data.dotFiles : []);
        } else if (Array.isArray(data)) {
          setFolders(data);
        } else {
          setFolders([]);
        }
      } else {
        console.error("Error fetching folders:", res.status, res.statusText);
        setFolders([]);
      }
    } catch (err) {
      console.error("Error fetching folders:", err);
      setFolders([]);
    }
  };

  const fetchSettings = async () => {
    if (!currentUser) return;

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${API_BASE}/api/user-settings`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const settings = await res.json();
        if (settings.transcriptionConfig) {
          const usingReplicate =
            settings.transcriptionConfig.mode === "replicate";
          setShowPromptInput(usingReplicate);
        }
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
    }
  };

  const handleCreateFolder = async () => {
    if (!currentUser || typeof window === "undefined") return;

    const folderName = window.prompt("Enter the name of the folder:");
    if (!folderName || !folderName.trim()) return;

    try {
      setCreatingFolder(true);

      const token = await currentUser.getIdToken();
      const res = await fetch(`${API_BASE}/api/folders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ folderName }),
      });

      let success = false;
      let message = "";

      if (res.ok) {
        success = true;
        try {
          const data = await res.json();
          message = data.message || "Folder created successfully";
        } catch (parseError) {
          message = "Folder created successfully";
        }
      } else {
        try {
          const errData = await res.json();
          message = errData.error || "Failed to create folder";
        } catch (parseError) {
          message = `Failed to create folder (${res.status})`;
        }
      }

      toast.current?.show({
        severity: success ? "success" : "error",
        summary: success ? "Folder Created" : "Error",
        detail: message,
        life: 3000,
      });

      if (success) {
        await fetchFolders();
      }
    } catch (err) {
      console.error("Error creating folder:", err);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "Failed to create folder. Please try again.",
        life: 3000,
      });
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleFolderClick = (folderName: string) => {
    router.push(`/folders/${folderName}`);
  };

  const handleDelete = async (id: string) => {
    if (!currentUser) return;

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${API_BASE}/api/docs/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setDocs((prev) => prev.filter((d) => d.id !== id));

        toast.current?.show({
          severity: "success",
          summary: "Document Deleted",
          detail: "Document moved to trash successfully",
          life: 3000,
        });
      } else {
        let errorMessage = "Failed to delete document";
        try {
          const errData = await res.json();
          errorMessage = errData.error || errorMessage;
        } catch (e) {
          // If response is not valid JSON
        }

        toast.current?.show({
          severity: "error",
          summary: "Error",
          detail: errorMessage,
          life: 3000,
        });
      }
    } catch (err) {
      console.error("Error deleting doc:", err);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "Failed to delete document. Please try again.",
        life: 3000,
      });
    }
  };

  const handleOpenMoveModal = (docId: string) => {
    setDocToMove(docId);
    setShowMoveModal(true);
  };

  const handleCloseMoveModal = () => {
    setShowMoveModal(false);
    setSelectedFolder("");
    setDocToMove(null);
  };

  const handleMoveToFolder = async () => {
    if (!selectedFolder || !docToMove || !currentUser) {
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "Please select a folder.",
        life: 3000,
      });
      return;
    }

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(
        `${API_BASE}/api/folders/${selectedFolder}/add/${docToMove}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (res.ok) {
        let message = "Document moved successfully";
        try {
          const data = await res.json();
          message = data.message || message;
        } catch (e) {
          // If not parseable JSON
        }

        toast.current?.show({
          severity: "success",
          summary: "Document Moved",
          detail: message,
          life: 3000,
        });

        setShowMoveModal(false);
        setSelectedFolder("");
        setDocToMove(null);
        await fetchDocs();
      } else {
        let errorMessage = "Failed to move document";
        try {
          const errData = await res.json();
          errorMessage = errData.error || errorMessage;
        } catch (e) {
          // If not parseable JSON
        }

        toast.current?.show({
          severity: "error",
          summary: "Error",
          detail: errorMessage,
          life: 3000,
        });
      }
    } catch (err) {
      console.error("Error moving document:", err);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "Failed to move document. Please try again.",
        life: 3000,
      });
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  const handleSuccessfulUpload = (docId: string) => {
    fetchDocs();
    setUploadMessage("Upload succeeded!");
  };

  if (!currentUser) {
    return null; // Redirecting to login in useEffect
  }

  return (
    <div className="home-container">
      <Toast ref={toast} position="top-right" />

      <div className="home-header">
        <h2>Home - Upload Audio =&gt; Create Doc</h2>
        <Button
          label="Logout"
          icon="pi pi-sign-out"
          className="p-button-text"
          onClick={handleLogout}
        />
      </div>

      {apiError && (
        <div className="api-error-banner">
          <i className="pi pi-exclamation-triangle"></i>
          <span>{apiError}</span>
          <Button
            label="Retry Connection"
            icon="pi pi-refresh"
            className="p-button-sm p-button-text"
            onClick={() => {
              fetchDocs();
              fetchFolders();
              fetchSettings();
            }}
          />
        </div>
      )}

      <div className="upload-section">
        {showPromptInput && (
          <div className="prompt-input">
            <p>
              Using Replicate API: Enter a prompt to guide transcription
              (optional)
            </p>
            <textarea
              placeholder="e.g., Please transcribe this audio accurately, paying attention to technical terms."
              value={transcriptionPrompt}
              onChange={(e) => setTranscriptionPrompt(e.target.value)}
              rows={2}
            />
          </div>
        )}

        <FileUpload
          onSuccessfulUpload={handleSuccessfulUpload}
          transcriptionPrompt={transcriptionPrompt}
        />

        {uploadMessage && <p className="message">{uploadMessage}</p>}
      </div>

      <hr className="divider" />

      <div className="folder-section">
        <Button
          label="Create Folder"
          icon="pi pi-folder-plus"
          onClick={handleCreateFolder}
          className="create-folder-btn"
          disabled={!currentUser || creatingFolder}
          loading={creatingFolder}
        />
      </div>

      <hr className="divider" />

      <div className="folders-section">
        <h3>Folders:</h3>
        {loading ? (
          <p>Loading folders...</p>
        ) : folders.length === 0 ? (
          <p>
            No folders created yet. Create your first folder to organize your
            documents.
          </p>
        ) : (
          <div className="docs-grid">
            {folders.map((folder) => (
              <div
                key={folder}
                className="doc-card folder-card"
                onClick={() => handleFolderClick(folder)}
              >
                <h4 className="doc-title">
                  <i className="pi pi-folder"></i> {folder}
                </h4>
              </div>
            ))}
          </div>
        )}
      </div>

      <hr className="divider" />

      <div className="docs-section">
        <h3>Docs in Session:</h3>
        {loading ? (
          <p>Loading documents...</p>
        ) : docs.length === 0 ? (
          <p>
            No documents available. Upload an audio file to create your first
            document.
          </p>
        ) : (
          <div className="docs-grid">
            {docs.map((doc) => (
              <div key={doc.id} className="doc-card">
                <h4 className="doc-title">{doc.name}</h4>
                {doc.audioFilename && (
                  <p className="audio-info">
                    Audio: {doc.audioFilename}
                    {doc.audioTrashed && " [TRASHED]"}
                  </p>
                )}

                <div className="doc-actions">
                  <Link
                    href={`/transcription/${doc.id}`}
                    target="_blank"
                    className="action-link transcription-link"
                  >
                    View Doc
                  </Link>
                  <Confirmable
                    onDelete={() => handleDelete(doc.id)}
                    toast={toast}
                  />
                  <button
                    onClick={() => handleOpenMoveModal(doc.id)}
                    className="action-link move-link orange-button"
                  >
                    Move to Folder
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        header="Move Document to Folder"
        visible={showMoveModal}
        style={{ width: "30vw" }}
        onHide={handleCloseMoveModal}
        footer={
          <div>
            <Button
              label="Cancel"
              icon="pi pi-times"
              className="p-button-text"
              onClick={handleCloseMoveModal}
            />
            <Button
              label="Move"
              icon="pi pi-check"
              onClick={handleMoveToFolder}
              disabled={!selectedFolder}
            />
          </div>
        }
      >
        <div>
          <Dropdown
            value={selectedFolder}
            options={folders.map((folder) => ({
              label: folder,
              value: folder,
            }))}
            onChange={(e) => setSelectedFolder(e.value)}
            placeholder="Select a folder"
            className="w-full"
          />
        </div>
      </Dialog>
    </div>
  );
}
