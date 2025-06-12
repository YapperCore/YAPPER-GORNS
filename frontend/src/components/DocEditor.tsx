'use client';

import React, { useState, useEffect } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { useAuth } from '@/context/AuthContext';
import { Toast } from 'primereact/toast';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { ProgressBar } from 'primereact/progressbar';
import Link from 'next/link';
import Editor from '@/components/Editor';
import { getSocket, joinDocRoom, leaveDocRoom, updateDocContent } from '@/lib/socket';

interface Doc {
  id: string;
  name: string;
  content?: string;
  audioFilename?: string;
  audioTrashed?: boolean;
  originalFilename?: string;
  owner?: string;
  firebaseUrl?: string;
  firebasePath?: string;
  localPath?: string;
}

export default function DocEditor() {
  const { currentUser } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  
  useEffect(() => {
    if (!currentUser) return;
    
    const fetchDocs = async () => {
      try {
        setLoading(true);
        setError("");

        const token = await currentUser.getIdToken();
        const res = await fetch("/api/docs", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);

        const data = await res.json();
        setDocs(Array.isArray(data) ? data : []);
        if (!Array.isArray(data)) {
          setError("Invalid data format received from server");
        }
      } catch (err: any) {
        console.error("Error loading docs:", err);
        setDocs([]);
        setError(`Error loading documents: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchDocs();
  }, [currentUser]);

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
        setDocs((prev) => prev.filter((d) => d.id !== id));
      } else {
        const errorData = await res.json();
        console.error("Failed to delete document:", errorData);
        setError(
          `Failed to delete document: ${errorData.error || "Unknown error"}`
        );
      }
    } catch (err: any) {
      console.error("Error deleting doc:", err);
      setError(`Error deleting document: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <ProgressBar mode="indeterminate" style={{ height: '6px' }} />
        <p className="mt-4">Loading documents...</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-slate-800 min-h-screen text-white">
      <h2 className="text-2xl font-bold mb-4">Documents</h2>
      
      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4">
          {error}
        </div>
      )}
      
      <Link href="/documents/new">
        <Button label="Create New Document" icon="pi pi-plus" className="mb-4" />
      </Link>

      {docs.length === 0 ? (
        <p className="mt-4">
          No documents found. Create a new one to get started!
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.map((doc) => (
            <div key={doc.id} className="bg-slate-700 p-4 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-2">{doc.name}</h3>
              
              {doc.audioFilename && (
                <p className="text-sm text-slate-300 mb-2">
                  Audio: {doc.audioFilename}
                  {doc.audioTrashed && <span className="text-red-400 ml-1">[TRASHED]</span>}
                </p>
              )}
              
              <div className="flex space-x-2 mt-4">
                <Link href={`/transcription/${doc.id}`}>
                  <Button label="View" icon="pi pi-eye" className="p-button-sm" />
                </Link>
                
                <Button 
                  label="Delete" 
                  icon="pi pi-trash" 
                  className="p-button-sm p-button-danger" 
                  onClick={() => handleDelete(doc.id)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
