// src/components/Confirmable.tsx
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
      acceptClassName: 'p-button-danger',
      accept,
      reject
    });
  };

  return (
    <>
      <ConfirmPopup />
      <button  
        onClick={confirmDelete} 
        className="action-link delete-link"
      >
        Delete Doc
      </button>
    </>
  );
}
