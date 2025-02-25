import React, { useRef } from 'react';
import { ConfirmPopup, confirmPopup } from 'primereact/confirmpopup';
import { Toast } from 'primereact/toast';
import { Button } from 'primereact/button';

/**
 * A "soft delete" confirm button that calls onDelete() 
 * (We use it to delete doc or move audio to trash)
 */
export default function Confirmable({ onDelete }) {
  const toast = useRef(null);

  const accept = () => {
    if(onDelete) onDelete();
    toast.current?.show({ severity:'info', summary:'Deleted', detail:'Item removed', life:2000 });
  };

  const reject = () => {
    toast.current?.show({ severity:'warn', summary:'Cancelled', detail:'No action taken', life:2000 });
  };

  const confirmDelete = (e) => {
    confirmPopup({
      target: e.currentTarget,
      message: 'Are you sure you want to delete?',
      icon: 'pi pi-info-circle',
      acceptClassName: 'p-button-danger',
      accept,
      reject
    });
  };

  return (
    <>
      <Toast ref={toast} />
      <ConfirmPopup />
      <Button onClick={confirmDelete} icon="pi pi-times" label="Delete" className="p-button-danger" />
    </>
  );
}

/**
 * Restore button for trash
 */
export function Restore({ onRestore }) {
  const toast = useRef(null);

  const accept = () => {
    if(onRestore) onRestore();
    toast.current?.show({ severity:'info', summary:'Restored', detail:'File restored', life:2000 });
  };

  const reject = () => {
    toast.current?.show({ severity:'warn', summary:'Cancelled', detail:'No action taken', life:2000 });
  };

  const confirmRestore = (e) => {
    confirmPopup({
      target: e.currentTarget,
      message: 'Restore this file?',
      icon: 'pi pi-info-circle',
      acceptClassName: 'p-button-success',
      accept,
      reject
    });
  };

  return (
    <>
      <Toast ref={toast} />
      <ConfirmPopup />
      <Button onClick={confirmRestore} icon="pi pi-check" label="Restore" className="p-button-success" style={{ marginLeft:'8px' }}/>
    </>
  );
}

/**
 * Permanent delete button
 */
export function PermDelete({ onDelete }) {
  const toast = useRef(null);

  const accept = () => {
    if(onDelete) onDelete();
    toast.current?.show({ severity:'info', summary:'Deleted', detail:'File permanently removed', life:2000 });
  };

  const reject = () => {
    toast.current?.show({ severity:'warn', summary:'Cancelled', detail:'No action taken', life:2000 });
  };

  const confirmPermDelete = (e) => {
    confirmPopup({
      target: e.currentTarget,
      message: 'Permanently delete this file?',
      icon: 'pi pi-exclamation-triangle',
      acceptClassName: 'p-button-danger',
      accept,
      reject
    });
  };

  return (
    <>
      <Toast ref={toast} />
      <ConfirmPopup />
      <Button onClick={confirmPermDelete} icon="pi pi-trash" label="PermDelete" className="p-button-danger" style={{ marginLeft:'8px' }}/>
    </>
  );
}
