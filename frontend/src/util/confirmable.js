import React, { useRef } from 'react';
import { ConfirmPopup, confirmPopup } from 'primereact/confirmpopup';
import { Toast } from 'primereact/toast';
import { Button } from 'primereact/button';

export default function Confirmable({ onDelete }) {
    const toast = useRef(null);

    const accept = async () => {
        try {
            await onDelete();
            toast.current?.show({ severity: 'info', summary: 'Confirmed', detail: 'Document deleted successfully', life: 3000 });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Failed to delete document', life: 3000 });
        }
    };

    const reject = () => {
        toast.current?.show({ severity: 'warn', summary: 'Rejected', detail: 'You have rejected', life: 3000 });
    };

    const confirmDelete = (event) => {
        confirmPopup({
            target: event.currentTarget,
            message: 'Do you want to delete this document?',
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
            <Button onClick={confirmDelete} icon="pi pi-times" label="Delete" className="p-button-danger"></Button>
        </>
    );
}

export function Restore({ onRestore }) {
    const toast = useRef(null);

    const accept = async () => {
        try {
            await onRestore();
            toast.current?.show({ severity: 'info', summary: 'Confirmed Restore', detail: 'Document restored successfully', life: 3000 });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Failed to restore document', life: 3000 });
        }
    };

    const reject = () => {
        toast.current?.show({ severity: 'warn', summary: 'Rejected Restore', detail: 'Document not restored', life: 3000 });
    };

    const confirmRestore = (event) => {
        confirmPopup({
            target: event.currentTarget,
            message: 'Do you want to restore this document?',
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
            <Button onClick={confirmRestore} icon="pi pi-check" label="Restore" className="p-button-success"></Button>
        </>
    );
}