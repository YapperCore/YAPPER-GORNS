import React, { useRef } from 'react';
import { ConfirmPopup, confirmPopup } from 'primereact/confirmpopup';
import { Toast } from 'primereact/toast';
import { Button } from 'primereact/button';

/**
 * A simple confirm button that calls onDelete() if user clicks "Accept".
 */
export default function Confirmable({ onDelete }) {
    const toast = useRef(null);

    const accept = () => {
        if(onDelete) {
            onDelete();
        }
        toast.current?.show({ severity: 'info', summary: 'Confirmed', detail: 'Deleted', life: 2000 });
    };

    const reject = () => {
        toast.current?.show({ severity: 'warn', summary: 'Cancelled', detail: 'No action taken', life: 2000 });
    };

    const confirmDelete = (event) => {
        confirmPopup({
            target: event.currentTarget,
            message: 'Delete this file?',
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
 * A "Restore" button that uses Prime confirm.
 */
export function Restore({ onRestore }) {
    const toast = useRef(null);

    const accept = async () => {
        if(onRestore) {
            await onRestore();
        }
        toast.current?.show({ severity: 'info', summary: 'Restored', detail: 'File restored', life: 2000 });
    };

    const reject = () => {
        toast.current?.show({ severity: 'warn', summary: 'Cancelled', detail: 'No action taken', life: 2000 });
    };

    const confirmRestore = (event) => {
        confirmPopup({
            target: event.currentTarget,
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
            <Button onClick={confirmRestore} icon="pi pi-refresh" label="Restore" className="p-button-success" />
        </>
    );
}
