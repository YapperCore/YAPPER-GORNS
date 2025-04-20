"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";
import { ConfirmDialog } from "primereact/confirmdialog";
import { useAuth } from "@/context/AuthContext"; // update if you're not using path aliases
import "primereact/resources/themes/saga-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "./TrashBucket.css"; // or wherever the styles are

export default function Trash() {
  const [trashFiles, setTrashFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [confirmVisible, setConfirmVisible] = useState<boolean>(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<boolean>(false);
  const toast = useRef<Toast>(null);
  const { currentUser } = useAuth();

  useEffect(() => {
    fetchTrashFiles();
  }, [currentUser]);

  const fetchTrashFiles = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch("/trash-files", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setTrashFiles(data.files || []);
    } catch (err) {
      console.error("Error fetching trash files:", err);
      showToast("error", "Error", "Failed to load trash files");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (
    severity: "success" | "info" | "warn" | "error",
    summary: string,
    detail: string
  ) => {
    toast.current?.show({ severity, summary, detail, life: 3000 });
  };

  const handleRestore = async (filename: string) => {
    if (!currentUser || actionInProgress) return;
    setActionInProgress(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`/restore_file/${filename}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setTrashFiles((prev) => prev.filter((f) => f !== filename));
        showToast("success", "Restored", "File restored successfully");
      } else {
        const data = await res.json();
        showToast("error", "Error", data.error || "Restore failed");
      }
    } catch (err) {
      console.error("Restore error:", err);
      showToast("error", "Error", "Failed to restore file");
    } finally {
      setActionInProgress(false);
    }
  };

  const confirmDelete = (filename: string) => {
    if (actionInProgress) return;
    setFileToDelete(filename);
    setConfirmVisible(true);
  };

  const handlePermDelete = async () => {
    if (!fileToDelete || !currentUser || actionInProgress) return;
    setActionInProgress(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`/perm_delete_files/${fileToDelete}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setTrashFiles((prev) => prev.filter((f) => f !== fileToDelete));
        showToast("success", "Deleted", "File permanently deleted");
      } else {
        const data = await res.json();
        showToast("error", "Error", data.error || "Failed to delete file");
      }
    } catch (err) {
      console.error("Delete error:", err);
      showToast("error", "Error", "Failed to delete file");
    } finally {
      setFileToDelete(null);
      setConfirmVisible(false);
      setActionInProgress(false);
    }
  };

  return (
    <div className="TrashBucket-container">
      <Toast ref={toast} position="top-right" />
      <ConfirmDialog
        visible={confirmVisible}
        onHide={() => setConfirmVisible(false)}
        message="Are you sure you want to permanently delete this file? This action cannot be undone."
        header="Confirm Permanent Deletion"
        icon="pi pi-exclamation-triangle"
        accept={handlePermDelete}
        reject={() => setConfirmVisible(false)}
        acceptClassName="p-button-danger"
      />

      <h2>Trash Page</h2>

      <div className="trash-controls">
        <Button
          icon="pi pi-refresh"
          label="Refresh"
          className="p-button-secondary"
          onClick={fetchTrashFiles}
          disabled={actionInProgress}
        />
      </div>

      {loading ? (
        <p>Loading trash files...</p>
      ) : trashFiles.length === 0 ? (
        <p>No files in trash</p>
      ) : (
        <div className="docs-grid">
          {trashFiles.map((file, i) => (
            <div key={i} className="doc-card">
              <h4 className="doc-title">Trashed file</h4>
              <p className="audio-info">{file}</p>
              <div className="doc-actions">
                <Button
                  icon="pi pi-undo"
                  label="Restore"
                  className="p-button-success"
                  onClick={() => handleRestore(file)}
                  disabled={actionInProgress}
                />
                <Button
                  icon="pi pi-trash"
                  label="Perm Delete"
                  className="p-button-danger"
                  onClick={() => confirmDelete(file)}
                  disabled={actionInProgress}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
