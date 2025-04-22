// src/pages/confirmable.tsx
"use client";

import React, { MouseEvent } from "react";
import { ConfirmPopup, confirmPopup } from "primereact/confirmpopup";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";
import "../static/Home.css";

interface ConfirmableProps {
  onDelete: () => Promise<void>;
  toast: React.RefObject<Toast>;
}

const Confirmable: React.FC<ConfirmableProps> = ({ onDelete, toast }) => {
  const accept = async () => {
    try {
      await onDelete();
      toast.current?.show({
        severity: "info",
        summary: "Deleted",
        detail: "Item deleted",
        life: 3000,
      });
    } catch (err) {
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "Failed to delete",
        life: 3000,
      });
    }
  };

  const reject = () => {
    toast.current?.show({
      severity: "warn",
      summary: "Cancelled",
      detail: "Deletion cancelled",
      life: 3000,
    });
  };

  const confirmDelete = (event: MouseEvent<HTMLAnchorElement>) => {
    confirmPopup({
      target: event.currentTarget,
      message: "Delete this item?",
      icon: "pi pi-info-circle",
      defaultFocus: "accept",
      acceptClassName: "p-button-success",
      accept,
      reject,
    });
  };

  return (
    <>
      <ConfirmPopup />
      <a onClick={confirmDelete} className="action-link delete-link">
        Delete Doc
      </a>
    </>
  );
};

interface RestoreProps {
  onRestore: () => Promise<void>;
  toast: React.RefObject<Toast>;
}

export const Restore: React.FC<RestoreProps> = ({ onRestore, toast }) => {
  const accept = async () => {
    try {
      await onRestore();
      toast.current?.show({
        severity: "info",
        summary: "Restored",
        detail: "Item restored",
        life: 3000,
      });
    } catch (err) {
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "Failed to restore",
        life: 3000,
      });
    }
  };

  const reject = () => {
    toast.current?.show({
      severity: "warn",
      summary: "Cancelled",
      detail: "Restore cancelled",
      life: 3000,
    });
  };

  const confirmRestore = (event: MouseEvent<HTMLButtonElement>) => {
    confirmPopup({
      target: event.currentTarget,
      message: "Restore this item?",
      icon: "pi pi-info-circle",
      defaultFocus: "accept",
      acceptClassName: "p-button-success",
      accept,
      reject,
    });
  };

  return (
    <Button
      onClick={confirmRestore}
      icon="pi pi-check"
      label="Restore"
      className="p-button-success"
    />
  );
};

interface PermDelProps {
  onDelete: () => Promise<void>;
  toast: React.RefObject<Toast>;
}

export const PermDel: React.FC<PermDelProps> = ({ onDelete, toast }) => {
  const handleDelete = async () => {
    try {
      await onDelete();
      toast.current?.show({
        severity: "info",
        summary: "Deleted",
        detail: "Item permanently deleted",
        life: 3000,
      });
    } catch (err) {
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "Failed to delete permanently",
        life: 3000,
      });
    }
  };

  return (
    <Button
      onClick={handleDelete}
      icon="pi pi-trash"
      label="Perm Delete"
      className="p-button-danger"
    />
  );
};

export default Confirmable;
