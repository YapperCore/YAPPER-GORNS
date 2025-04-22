// src/app/home/page.tsx
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

interface FolderOption {
  label: string;
  value: string;
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
  const [confirmDeleteDialog, setConfirmDeleteDialog] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState("");
  const [folderDocs, setFolderDocs] = useState<Document[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [loadingFolderDocs, setLoadingFolderDocs] = useState(false);
  const toast = useRef<Toast>(null);
  const { currentUser } = useAuth();
  const router = useRouter();

  // Fetch data only once when component mounts
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!currentUser) {
      router.push("/login");
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch data in parallel
        await Promise.all([fetchDocs(), fetchFolders(), fetchSettings()]);
      } catch (err) {
        console.error("Error fetching data:", err);
        toast.current?.show({
          severity: "error",
          summary: "Error",
          detail: "Failed to load data. Please refresh and try again.",
          life: 3000,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser, router]);

  const fetchDocs = async () => {
    if (!currentUser) return;

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch("/api/docs", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        // Filter out documents that are in trash
        const activeDocs = Array.isArray(data)
          ? data.filter((doc) => !doc.audioTrashed && !doc.deleted)
          : [];
        setDocs(activeDocs);
      } else {
        console.error("Error fetching docs:", res.status, res.statusText);
        setDocs([]);

        if (res.status === 401) {
          // Unauthorized, redirect to login
          router.push("/login");
        }
      }
    } catch (err) {
      console.error("Error fetching docs:", err);
      setDocs([]);
    }
  };

  const fetchFolders = async () => {
    if (!currentUser) return;

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch("/api/folders", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();

        // Handle both format types
        if (data && data.dotFiles) {
          setFolders(Array.isArray(data.dotFiles) ? data.dotFiles : []);
        } else if (Array.isArray(data)) {
          setFolders(data);
        } else {
          console.warn("Unexpected folder data format:", data);
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
      const res = await fetch("/api/user-settings", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const settings = await res.json();
        if (settings.transcriptionConfig) {
          // Check if using Replicate API
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
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ folderName }),
      });

      if (res.ok) {
        const data = await res.json();

        toast.current?.show({
          severity: "success",
          summary: "Folder Created",
          detail: data.message || "Folder created successfully",
          life: 3000,
        });

        // Refresh folders list
        await fetchFolders();
      } else {
        let errorMessage = "Failed to create folder";
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

  const handleDeleteButtonClick = async (folderName: string) => {
    setFolderToDelete(folderName);
    setConfirmDeleteDialog(true);
    await fetchDocsInFolder(folderName);
  };

  const fetchDocsInFolder = async (folderName: string) => {
    if (!currentUser) return;

    setLoadingFolderDocs(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/folders/${folderName}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setFolderDocs(Array.isArray(data) ? data : []);
        setSelectedDocs(Array.isArray(data) ? data.map((doc) => doc.id) : []);
      } else {
        console.error(
          "Error fetching docs in folder:",
          res.status,
          res.statusText
        );
        setFolderDocs([]);
        setSelectedDocs([]);
      }
    } catch (err) {
      console.error("Error fetching docs in folder:", err);
      setFolderDocs([]);
      setSelectedDocs([]);
    } finally {
      setLoadingFolderDocs(false);
    }
  };

  const handleCheckboxChange = (docId: string) => {
    setSelectedDocs((prev) => {
      if (prev.includes(docId)) {
        return prev.filter((id) => id !== docId);
      } else {
        return [...prev, docId];
      }
    });
  };

  const handleSelectAllChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedDocs(folderDocs.map((doc) => doc.id));
    } else {
      setSelectedDocs([]);
    }
  };

  const handleDeleteAll = async () => {
    await handleDeleteFolder(true);
  };

  const handleDeleteSelected = async () => {
    await handleDeleteFolder(false);
  };

  const handleDeleteFolder = async (deleteAll: boolean = true) => {
    if (!currentUser || !folderToDelete) return;
    setLoading(true);

    try {
      const token = await currentUser.getIdToken();
      const docsToDelete = deleteAll ? [] : selectedDocs;

      const res = await fetch(`/api/folders/${folderToDelete}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deleteAll,
          docsToDelete,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.current?.show({
          severity: "success",
          summary: "Folder Deleted",
          detail:
            data.message ||
            `Folder deleted. ${
              data.movedToTrash?.length || 0
            } files moved to trash.`,
          life: 3000,
        });

        // Refresh folders list and documents
        await fetchFolders();
        await fetchDocs(); // Important to refresh docs as their status changed
      } else {
        toast.current?.show({
          severity: "error",
          summary: "Error",
          detail: data.error || "Failed to delete folder",
          life: 3000,
        });
      }
    } catch (err) {
      console.error("Error deleting folder:", err);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "An unexpected error occurred while deleting the folder",
        life: 3000,
      });
    } finally {
      setLoading(false);
      setConfirmDeleteDialog(false);
      setFolderDocs([]);
      setSelectedDocs([]);
    }
  };

  const handleDelete = async (id: string) => {
    if (!currentUser) return;

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/docs/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        // Update local state to remove the deleted document
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
        `/api/folders/${selectedFolder}/add/${docToMove}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (res.ok) {
        const data = await res.json();

        toast.current?.show({
          severity: "success",
          summary: "Document Moved",
          detail: data.message || "Document moved successfully",
          life: 3000,
        });

        // Close the modal and reset selection
        setShowMoveModal(false);
        setSelectedFolder("");
        setDocToMove(null);

        // Refresh documents list after moving
        await fetchDocs();
      } else {
        let errorMessage = "Failed to move document";
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
      console.error("Error moving document:", err);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "Failed to move document. Please try again.",
        life: 3000,
      });
    }
  };

  const handleSuccessfulUpload = (docId: string) => {
    // Refresh documents after a successful upload
    fetchDocs();
    setUploadMessage("Upload succeeded!");
  };

  const confirmDialogFooter = (
    <div className="dialog-footer">
      <Button
        label="Cancel"
        icon="pi pi-times"
        className="p-button-text"
        onClick={() => setConfirmDeleteDialog(false)}
      />
      <Button
        label="Delete Selected"
        icon="pi pi-trash"
        className="p-button-warning"
        disabled={selectedDocs.length === 0}
        onClick={handleDeleteSelected}
      />
      <Button
        label="Delete All"
        icon="pi pi-trash"
        className="p-button-danger"
        onClick={handleDeleteAll}
      />
    </div>
  );

  if (!currentUser) {
    return null; // Redirecting to login in useEffect
  }

  return (
    <div className="home-container">
      <Toast ref={toast} position="top-right" />

      <div className="home-header">
        <h2>Home - Upload Audio =&gt; Create Doc</h2>
      </div>

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
              <div key={folder} className="doc-card folder-card">
                <div
                  className="folder-content"
                  onClick={() => handleFolderClick(folder)}
                >
                  <h4 className="doc-title">
                    <i className="pi pi-folder"></i> {folder}
                  </h4>
                </div>
                <div className="folder-actions">
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent folder opening
                      handleDeleteButtonClick(folder);
                    }}
                    className="folder-delete-btn"
                    title="Delete folder"
                  >
                    <i className="pi pi-trash"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        header={`Delete Folder: ${folderToDelete}`}
        visible={confirmDeleteDialog}
        style={{ width: "500px" }}
        footer={confirmDialogFooter}
        onHide={() => setConfirmDeleteDialog(false)}
      >
        <div className="confirmation-content">
          <i
            className="pi pi-exclamation-triangle"
            style={{ fontSize: "2rem", color: "#ff9800", marginRight: "10px" }}
          />
          <span>
            Are you sure you want to delete the folder{" "}
            <strong>{folderToDelete}</strong>? Select which documents to move to
            trash:
          </span>
        </div>

        <div className="folder-docs-list">
          {loadingFolderDocs ? (
            <p>Loading documents...</p>
          ) : folderDocs.length === 0 ? (
            <p>This folder is empty.</p>
          ) : (
            <>
              <div className="select-all-container">
                <label className="select-all-label">
                  <input
                    type="checkbox"
                    checked={
                      selectedDocs.length === folderDocs.length &&
                      folderDocs.length > 0
                    }
                    onChange={handleSelectAllChange}
                  />
                  Select All Documents
                </label>
              </div>
              <ul className="doc-checkbox-list">
                {folderDocs.map((doc) => (
                  <li key={doc.id} className="doc-checkbox-item">
                    <label className="doc-checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedDocs.includes(doc.id)}
                        onChange={() => handleCheckboxChange(doc.id)}
                      />
                      <span className="doc-name">{doc.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </Dialog>

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
                    className="action-link move-link"
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
