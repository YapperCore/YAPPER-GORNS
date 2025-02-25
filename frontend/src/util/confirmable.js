import React, { useRef } from 'react';
import { ConfirmPopup, confirmPopup } from 'primereact/confirmpopup';
import { Toast } from 'primereact/toast';
import { Button } from 'primereact/button';

export default function Confirmable({ onDelete }) {
    const toast = useRef(null);

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

    const confirmDelete = event => {
        confirmPopup({
            target: event.currentTarget,
            message: 'Delete this item?',
            icon: 'pi pi-info-circle',
            defaultFocus: 'reject',
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

export function Restore({ onRestore }) {
    const toast = useRef(null);

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

    const confirmRestore = event => {
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
        <>
            <Toast ref={toast} />
            <ConfirmPopup />
            <Button onClick={confirmRestore} icon="pi pi-check" label="Restore" className="p-button-success" />
        </>
    );
}
