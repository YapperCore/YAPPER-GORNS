"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Toast } from "primereact/toast";
import { Button } from "primereact/button";
import { ConfirmDialog } from "primereact/confirmdialog";

interface Doc {
  id: string;
  name: string;
  audioFilename?: string;
  audioTrashed?: boolean;
}

export default function FolderDocs() {
  const params = useParams();
  const folderName = params.folderName as string;
  const { currentUser } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dataFetched, setDataFetched] = useState<boolean>(false);
  const [confirmDialogVisible, setConfirmDialogVisible] = useState<boolean>(false);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);
  const toast = useRef<Toast>(null);
  const router = useRouter();

  // Only fetch once when component mounts
  useEffect(() => {
    if (typeof window === 'undefined' || !currentUser || !folderName || dataFetched) return;

    async function fetchDocs() {
      setLoading(true);
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch(`/api/folders/${folderName}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          if (res.status === 404) {
            setError(`Folder "${folderName}" not found.`);
          } else {
            const errData = await res.json();
            setError(errData.error || "Failed to load documents.");
          }
          setDocs([]);
        } else {
          const data = await res.json();
          setDocs(Array.isArray(data) ? data : []);
          setError(null);
        }

        setDataFetched(true);
      } catch (err) {
        console.error("Error fetching folder docs:", err);
        setError("An unexpected error occurred.");
        setDocs([]);
      } finally {
        setLoading(false);
      }
    }

    fetchDocs();
  }, [currentUser, folderName, dataFetched]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!currentUser && typeof window !== 'undefined') {
      router.push('/login');
    }
  }, [currentUser, router]);

  const handleMoveToHome = async (docId: string) => {
    if (!currentUser) return;

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/folders/home/add/${docId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json();
        console.error("Error moving document to home:", errData.error);

        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: errData.error || 'Failed to move document',
          life: 3000
        });
      } else {
        setDocs((prevDocs) => prevDocs.filter((doc) => doc.id !== docId));

        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: 'Document moved to home successfully',
          life: 3000
        });
      }
    } catch (err) {
      console.error("Error moving document to home:", err);

      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to move document',
        life: 3000
      });
    }
  };

  const confirmDelete = (docId: string) => {
    setDocToDelete(docId);
    setConfirmDialogVisible(true);
  };

  const handleDelete = async () => {
    if (!currentUser || !docToDelete) return;

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/docs/${docToDelete}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setDocs((prevDocs) => prevDocs.filter((doc) => doc.id !== docToDelete));

        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: 'Document deleted successfully',
          life: 3000
        });
      } else {
        const errData = await res.json();
        console.error("Error deleting document:", errData.error);

        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: errData.error || 'Failed to delete document',
          life: 3000
        });
      }
    } catch (err) {
      console.error("Error deleting document:", err);

      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to delete document',
        life: 3000
      });
    } finally {
      setDocToDelete(null);
      setConfirmDialogVisible(false);
    }
  };

  if (!currentUser) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="home-container">
      <Toast ref={toast} position="top-right" />
      <ConfirmDialog
        visible={confirmDialogVisible}
        onHide={() => setConfirmDialogVisible(false)}
        message="Are you sure you want to delete this document?"
        header="Confirm Delete"
        icon="pi pi-exclamation-triangle"
        accept={handleDelete}
        reject={() => setConfirmDialogVisible(false)}
      />

      <h2>Documents in Folder: {folderName}</h2>
      {error && <p style={{ color: "red", fontWeight: "bold" }}>{error}</p>}

      {loading && <p>Loading documents...</p>}

      {!loading && !error && docs.length === 0 && (
        <p>No documents found in this folder.</p>
      )}

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
                className="action-link transcription-link"
              >
                View Doc
              </Link>
              <Link
                href={`/docs/edit/${doc.id}`}
                className="action-link edit-link"
              >
                Edit Doc
              </Link>
              <button
                onClick={() => confirmDelete(doc.id)}
                className="action-link delete-link"
              >
                Delete Doc
              </button>
              <button
                onClick={() => handleMoveToHome(doc.id)}
                className="action-link move-link orange-button"
              >
                Move to Home
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '1rem' }}>
        <Link href="/home">
          <Button label="Back to Home" icon="pi pi-arrow-left" className="p-button-secondary" />
        </Link>
      </div>
    </div>
  );
}
