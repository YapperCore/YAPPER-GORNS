"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useParams } from "next/navigation";
import { JSX } from "react/jsx-runtime";

interface Doc {
  id: string;
  name: string;
  audioFilename?: string;
  audioTrashed?: boolean;
}

export default function FolderDocs(): JSX.Element {
  const { folderName } = useParams() as { folderName?: string };
  const { currentUser } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDocs() {
      if (currentUser && folderName) {
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
            return;
          }

          const data = await res.json();
          setDocs(Array.isArray(data) ? data : []);
          setError(null);
        } catch (err) {
          console.error("Error fetching folder docs:", err);
          setError("An unexpected error occurred.");
          setDocs([]);
        } finally {
          setLoading(false);
        }
      }
    }

    fetchDocs();
  }, [currentUser, folderName]);

  const handleMoveToHome = async (docId: string) => {
    try {
      const token = await currentUser?.getIdToken();
      const res = await fetch(`/api/folders/home/add/${docId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json();
        console.error("Error moving document to home:", errData.error);
      } else {
        setDocs((prevDocs) => prevDocs.filter((doc) => doc.id !== docId));
      }
    } catch (err) {
      console.error("Error moving document to home:", err);
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      const token = await currentUser?.getIdToken();
      const res = await fetch(`/api/docs/${docId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setDocs((prevDocs) => prevDocs.filter((doc) => doc.id !== docId));
      } else {
        const errData = await res.json();
        console.error("Error deleting document:", errData.error);
      }
    } catch (err) {
      console.error("Error deleting document:", err);
    }
  };

  return (
    <div className="home-container">
      <h2>Documents in Folder: {folderName}</h2>

      {loading && <p>Loading documents...</p>}
      {error && <p style={{ color: "red", fontWeight: "bold" }}>{error}</p>}
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
              <a
                href={`/transcription/${doc.id}`}
                rel="noreferrer"
                className="action-link transcription-link"
              >
                View Doc
              </a>
              <a
                href={`/docs/edit/${doc.id}`}
                rel="noreferrer"
                className="action-link edit-link"
              >
                Edit Doc
              </a>
              <button
                onClick={() => handleDelete(doc.id)}
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
    </div>
  );
}
