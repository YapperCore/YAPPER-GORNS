// frontends/src/components/Confirmable.tsx
'use client';

import React from 'react';
import { ConfirmPopup, confirmPopup } from 'primereact/confirmpopup';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';

interface ConfirmableProps {
  onDelete: () => Promise<void>;
  toast: React.RefObject<Toast>;
}

export default function Confirmable({ onDelete, toast }: ConfirmableProps) {
  const accept = async () => {
    try {
      await onDelete();
      toast.current?.show({ severity: 'info', summary: 'Deleted', detail: 'Item deleted', life: 3000 });
    } catch (err) {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Failed to delete', life: 3000 });
    }
  };

  const reject = () => {
    toast.current?.show({ severity: 'warn', summary: 'Cancelled', detail: 'Deletion cancelled', life: 3000 });
  };

  const confirmDelete = (event: React.MouseEvent<HTMLButtonElement>) => {
    confirmPopup({
      target: event.currentTarget,
      message: 'Delete this item?',
      icon: 'pi pi-info-circle',
      defaultFocus: 'accept',
      acceptClassName: 'p-button-success',
      accept,
      reject
    });
  };

  return (
    <>
      <ConfirmPopup />
      <button  
        onClick={confirmDelete} 
        className="action-link delete-link bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
      >
        Delete Doc
      </button>
    </>
  );
}

interface RestoreProps {
  onRestore: () => Promise<void>;
  toast: React.RefObject<Toast>;
}

export function Restore({ onRestore, toast }: RestoreProps) {
  const accept = async () => {
    try {
      await onRestore();
      toast.current?.show({ severity: 'info', summary: 'Restored', detail: 'Item restored', life: 3000 });
    } catch(err){
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Failed to restore', life: 3000 });
    }
  };

  const reject = () => {
    toast.current?.show({ severity: 'warn', summary: 'Cancelled', detail: 'Restore cancelled', life: 3000 });
  };

  const confirmRestore = (event: React.MouseEvent<HTMLButtonElement>) => {
    confirmPopup({
      target: event.currentTarget,
      message: 'Restore this item?',
      icon: 'pi pi-info-circle',
      defaultFocus: 'accept',
      acceptClassName: 'p-button-success',
      accept,
      reject
    });
  };

  return (
    <Button onClick={confirmRestore} icon="pi pi-check" label="Restore" className="p-button-success" />
  );
}

interface PermDelProps {
  onDelete: () => Promise<void>;
  toast: React.RefObject<Toast>;
}

export function PermDel({ onDelete, toast }: PermDelProps) {
  const handleDelete = async () => {
    try {
      await onDelete();
      toast.current?.show({ severity: 'info', summary: 'Deleted', detail: 'Item permanently deleted', life: 3000 });
    } catch (err) {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Failed to delete permanently', life: 3000 });
    }
  };

  return (
    <Button onClick={handleDelete} icon="pi pi-trash" label="Perm Delete" className="p-button-danger" />
  );
}
