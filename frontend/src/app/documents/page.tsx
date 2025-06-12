"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";
import { Checkbox } from "primereact/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "../../components/ui/dialog";

interface Document {
  id: string;
  name: string;
  content?: string;
  audioFilename?: string;
  audioTrashed?: boolean;
  deleted?: boolean;
  folderName?: string;
}

export default function Documents() {
  const { currentUser } = useAuth();
  const router = useRouter();
  const [folders, setFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const toast = useRef<Toast>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState("");
  const [folderDocs, setFolderDocs] = useState<Document[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [loadingFolderDocs, setLoadingFolderDocs] = useState(false);

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!currentUser && typeof window !== "undefined") {
      router.push("/login");
      return;
    }

    async function fetchFolders() {
      if (!currentUser) return;

      try {
        setLoading(true);
        const token = await currentUser.getIdToken();
        const res = await fetch("/api/folders", {
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
            console.warn("Unexpected folder data format:", data);
            setFolders([]);
          }
        } else {
          toast.current?.show({
            severity: "error",
            summary: "Error",
            detail: "Failed to load folders",
          });
        }
      } catch (err) {
        console.error("Error fetching folders:", err);
        toast.current?.show({
          severity: "error",
          summary: "Error",
          detail: "Failed to load folders",
        });
      } finally {
        setLoading(false);
      }
    }

    fetchFolders();
  }, [currentUser, router]);

  const handleCreateFolder = async () => {
    if (!currentUser || !newFolderName.trim()) return;

    try {
      setCreatingFolder(true);

      const token = await currentUser.getIdToken();
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ folderName: newFolderName }),
      });

      if (res.ok) {
        const data = await res.json();

        toast.current?.show({
          severity: "success",
          summary: "Folder Created",
          detail: data.message || "Folder created successfully",
          life: 3000,
        });

        const foldersRes = await fetch("/api/folders", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (foldersRes.ok) {
          const data = await foldersRes.json();
          if (data && data.dotFiles) {
            setFolders(Array.isArray(data.dotFiles) ? data.dotFiles : []);
          } else if (Array.isArray(data)) {
            setFolders(data);
          }
        }

        setIsDialogOpen(false);
      } else {
        let errorMessage = "Failed to create folder";
        try {
          const errData = await res.json();
          errorMessage = errData.error || errorMessage;
        } catch (e) {}

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
      setNewFolderName("");
    }
  };

  const handleDeleteButtonClick = async (folderName: string) => {
    setFolderToDelete(folderName);
    setIsDeleteDialogOpen(true);
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

<<<<<<< HEAD
  const handleSelectAllChange = (e: any) => {
    if (e.target.checked) {
      setSelectedDocs(folderDocs.map((doc) => doc.id));
=======
  // Update the function to accept CheckboxChangeEvent from PrimeReact
  const handleSelectAllChange = (e: { checked?: boolean }) => {
    if (e.checked) {
      setSelectedDocs(folderDocs.map(doc => doc.id));
>>>>>>> SCRUM-4-spike-on-ACM-vs-nginx
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

        const foldersRes = await fetch("/api/folders", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (foldersRes.ok) {
          const data = await foldersRes.json();
          if (data && data.dotFiles) {
            setFolders(Array.isArray(data.dotFiles) ? data.dotFiles : []);
          } else if (Array.isArray(data)) {
            setFolders(data);
          }
        }
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
      setIsDeleteDialogOpen(false);
      setFolderDocs([]);
      setSelectedDocs([]);
    }
  };

  if (!currentUser) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="container mx-auto px-4 max-w-5xl">
      <Toast ref={toast} position="top-right" />

      <div className="flex justify-between items-center mb-6 mt-4">
        <h2 className="text-2xl font-bold">Document Folders</h2>

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
              <DialogTitle className="text-lg font-bold">
                Create a New Folder
              </DialogTitle>
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
      </div>

      {loading ? (
        <p className="text-center py-4">Loading folders...</p>
      ) : (
        <>
          {folders.length === 0 ? (
            <p className="text-center py-4">
              No folders found. Create a folder to organize your documents.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 justify-items-center">
              {folders.map((folder) => (
                <div
                  key={folder}
                  className="doc-card folder-card w-full max-w-xs"
                >
                  <div
                    className="folder-content"
                    onClick={() => router.push(`/folders/${folder}`)}
                  >
                    <h4 className="doc-title">
                      <i className="pi pi-folder mr-2"></i> {folder}
                    </h4>
                  </div>
                  <div className="folder-actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
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
        </>
      )}

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="bg-slate-800 text-white p-6 rounded-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              Delete Folder: {folderToDelete}
            </DialogTitle>
          </DialogHeader>
          <div className="folder-docs-list mt-4 bg-slate-900">
            {loadingFolderDocs ? (
              <p>Loading documents...</p>
            ) : folderDocs.length === 0 ? (
              <p>This folder is empty.</p>
            ) : (
              <>
                <div className="select-all-container mb-2">
                  <Checkbox
                    inputId="selectAll"
                    checked={
                      selectedDocs.length === folderDocs.length &&
                      folderDocs.length > 0
                    }
                    onChange={(e) => handleSelectAllChange(e)}
                  />
                  <label htmlFor="selectAll" className="ml-2">
                    Select All Documents
                  </label>
                </div>
                <ul className="doc-checkbox-list">
                  {folderDocs.map((doc) => (
                    <li
                      key={doc.id}
                      className="doc-checkbox-item flex items-center mb-2"
                    >
                      <Checkbox
                        inputId={`doc-${doc.id}`}
                        checked={selectedDocs.includes(doc.id)}
                        onChange={() => handleCheckboxChange(doc.id)}
                      />
                      <label htmlFor={`doc-${doc.id}`} className="ml-2">
                        {doc.name}
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <DialogFooter className="mt-4 flex justify-end">
            <Button
              label="Cancel"
              icon="pi pi-times"
              className="bg-gray-500 text-white hover:bg-gray-600 px-6 py-3"
              onClick={() => setIsDeleteDialogOpen(false)}
            />
            <Button
              label="Delete Selected"
              icon="pi pi-trash"
              className="bg-yellow-500 text-white hover:bg-yellow-600 ml-2"
              onClick={handleDeleteSelected}
              disabled={selectedDocs.length === 0}
            />
            <Button
              label="Delete All"
              icon="pi pi-trash"
              className="bg-red-500 text-white hover:bg-red-600 ml-2"
              onClick={handleDeleteAll}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
