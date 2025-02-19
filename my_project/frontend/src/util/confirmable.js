import React, { useRef } from 'react';
import { ConfirmPopup, confirmPopup } from 'primereact/confirmpopup';
import { Toast } from 'primereact/toast';
import { Button } from 'primereact/button';

export default function Confirmable({ onDelete }) {
    const toast = useRef(null);

    const accept = () => {
        toast.current?.show({ severity: 'info', summary: 'Confirmed', detail: 'You have accepted', life: 3000 });
        onDelete();
    };

    const reject = () => {
        toast.current?.show({ severity: 'warn', summary: 'Rejected', detail: 'You have rejected', life: 3000 });
    };

    const confirmDelete = (event) => {
        confirmPopup({
            target: event.currentTarget,
            message: 'Do you want to delete this doc?',
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