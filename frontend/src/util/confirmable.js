// src/util/confirmable.js
import React, { useState, useRef } from 'react';
import { ConfirmPopup, confirmPopup } from 'primereact/confirmpopup';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';

// Regular delete button (for docs)
export default function Confirmable({ onDelete, toast }) {
  const confirm = (event) => {
    confirmPopup({
      target: event.currentTarget,
      message: 'Are you sure you want to delete this item?',
      icon: 'pi pi-exclamation-triangle',
      accept: async () => {
        try {
          await onDelete();
          if (toast && toast.current) {
            toast.current.show({ severity: 'info', summary: 'Deleted', detail: 'Item deleted', life: 3000 });
          }
        } catch (err) {
          if (toast && toast.current) {
            toast.current.show({ severity: 'error', summary: 'Error', detail: 'Failed to delete', life: 3000 });
          }
        }
      }
    });
  };

  return (
    <>
      <Button 
        label="Delete" 
        icon="pi pi-trash" 
        className="p-button-danger" 
        onClick={confirm} 
      />
    </>
  );
}

// Restore button for trash items
export function Restore({ filename, onSuccess, toast, api }) {
  const [loading, setLoading] = useState(false);
  
  const handleRestore = async () => {
    try {
      setLoading(true);
      
      if (api) {
        await api.get(`/restore_file/${filename}`);
      } else {
        // Fallback to regular fetch
        const response = await fetch(`/restore_file/${filename}`, { method: 'GET' });
        if (!response.ok) throw new Error('Failed to restore');
      }
      
      if (onSuccess) {
        onSuccess(filename);
      } else if (toast && toast.current) {
        // Show toast only if no success callback provided
        toast.current.show({ 
          severity: 'success', 
          summary: 'Success', 
          detail: 'File restored successfully' 
        });
      }
    } catch (error) {
      console.error('Error restoring file:', error);
      if (toast && toast.current) {
        toast.current.show({ 
          severity: 'error', 
          summary: 'Error', 
          detail: 'Failed to restore file' 
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const confirm = (event) => {
    confirmPopup({
      target: event.currentTarget,
      message: 'Restore this file?',
      icon: 'pi pi-info-circle',
      accept: handleRestore
    });
  };

  return (
    <Button 
      label="Restore" 
      icon="pi pi-refresh" 
      className="p-button-success" 
      onClick={confirm}
      loading={loading} 
    />
  );
}

// Permanent delete button for trash items
export function PermDel({ filename, onSuccess, toast, api }) {
  const [loading, setLoading] = useState(false);
  
  const handleDelete = async () => {
    try {
      setLoading(true);
      
      if (api) {
        await api.delete(`/delete_file/${filename}`);
      } else {
        // Fallback to regular fetch
        const response = await fetch(`/delete_file/${filename}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete');
      }
      
      if (onSuccess) {
        onSuccess(filename);
      } else if (toast && toast.current) {
        // Show toast only if no success callback provided
        toast.current.show({ 
          severity: 'success', 
          summary: 'Success', 
          detail: 'File permanently deleted' 
        });
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      if (toast && toast.current) {
        toast.current.show({ 
          severity: 'error', 
          summary: 'Error', 
          detail: 'Failed to delete file' 
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const confirm = (event) => {
    confirmPopup({
      target: event.currentTarget,
      message: 'Permanently delete this file? This cannot be undone.',
      icon: 'pi pi-exclamation-triangle',
      accept: handleDelete
    });
  };

  return (
    <Button 
      label="Delete Forever" 
      icon="pi pi-trash" 
      className="p-button-danger" 
      onClick={confirm}
      loading={loading} 
    />
  );
}
