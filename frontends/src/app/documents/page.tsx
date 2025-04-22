"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';


export default function Documents() {
  const { currentUser } = useAuth();
  const router = useRouter();
  const [folders, setFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const toast = useRef<Toast>(null);

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!currentUser && typeof window !== 'undefined') {
      router.push('/login');
      return;
    }

    async function fetchFolders() {
      if (!currentUser) return;

      try {
        setLoading(true);
        const token = await currentUser.getIdToken();
        const res = await fetch('/api/folders', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          setFolders(Array.isArray(data.dotFiles) ? data.dotFiles : []);
        } else {
          toast.current?.show({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load folders'
          });
        }
      } catch (err) {
        console.error("Error fetching folders:", err);
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load folders'
        });
      } finally {
        setLoading(false);
      }
    }

    fetchFolders();
  }, [currentUser, router]);


  const handleCreateFolder = async () => {
    if (!currentUser) return;

    const folderName = window.prompt("Enter the name of the folder:");
    if (!folderName) return;

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ folderName })
      });

      if (res.ok) {
        toast.current?.show({
          severity: 'success',
          summary: 'Folder Created',
          detail: 'New folder has been created successfully',
          life: 3000
        });

        // Refresh folders
        const foldersRes = await fetch('/api/folders', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (foldersRes.ok) {
          const data = await foldersRes.json();
          setFolders(Array.isArray(data.dotFiles) ? data.dotFiles : []);
        }
      } else {
        const errData = await res.json();
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: errData.error || 'Failed to create folder',
          life: 3000
        });
      }
    } catch (err) {
      console.error("Error creating folder:", err);
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to create folder',
        life: 3000
      });
    }
  };

  if (!currentUser) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="container">
      <Toast ref={toast} position="top-right" />

      <div className="flex justify-between items-center mb-6 mt-4">
        <h2 className="text-2xl font-bold">Folders</h2>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              label="Create Folder"
              icon="pi pi-folder-plus"
              className="create-folder-btn ml-auto"
              disabled={!currentUser || creatingFolder}
            />
          </DialogTrigger>
          <DialogContent className="bg-black text-white p-6 rounded-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Create a New Folder</DialogTitle>
              <DialogDescription className="text-sm">
                Enter the name of the folder you want to create.
              </DialogDescription>
            </DialogHeader>
            <div className="dialog-body mt-4">
              <input
                type="text"
                placeholder="Folder Name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="w-full p-2 border border-gray-500 rounded bg-gray-800 text-white"
              />
            </div>
            <DialogFooter className="mt-4 flex justify-end">
              <Button
                label="Create"
                icon="pi pi-check"
                type="button"
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim() || creatingFolder}
                loading={creatingFolder}
                className="bg-blue-500 text-white hover:bg-blue-600"
              />
            </DialogFooter>
          </DialogContent>
        </Dialog>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Document Folders</h2>
        <Button label="Create Folder" icon="pi pi-plus" onClick={handleCreateFolder} />
      </div>
      

      {loading ? (
        <p>Loading folders...</p>
      ) : (
        <>
          {folders.length === 0 ? (
            <p>No folders found. Create a folder to organize your documents.</p>
          ) : (
            <div className="docs-grid">
              {folders.map((folder) => (
                <div key={folder} className="doc-card" onClick={() => router.push(`/folders/${folder}`)}>
                  <h4 className="doc-title">{folder}</h4>
                  <p>Folder</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
