"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "primereact/button";
import { Sidebar } from "primereact/sidebar";
import { useState } from "react";
import "../styles/Navbar.css";

const Navbar = () => {
  const { currentUser, logout } = useAuth();
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  return (
    <div>
      <Button
        icon="pi pi-bars"
        className="menu-button p-button-text"
        onClick={() => setVisible(true)}
      />
      <Sidebar visible={visible} onHide={() => setVisible(false)}>
        <h1 className="logo">Yapper</h1>
        <ul className="sidebar-links">
          {currentUser ? (
            <>
              <li>
                <Link href="/home">Home</Link>
              </li>
              <li>
                <Link href="/documents">Documents</Link>
              </li>
              <li>
                <Link href="/settings">Settings</Link>
              </li>
              <li>
                <Link href="/trash">Trash</Link>
              </li>
              <li>
                <Button
                  onClick={handleLogout}
                  className="logout-btn p-button-danger p-button-sm"
                  label="Logout"
                  icon="pi pi-sign-out"
                />
              </li>
            </>
          ) : (
            <div className="nav-buttons">
              <li>
                <Link href="/login">
                  <Button
                    className="p-button-outlined p-button-sm"
                    label="Login"
                  />
                </Link>
              </li>
              <li>
                <Link href="/signup">
                  <Button className="p-button-sm" label="Sign Up" />
                </Link>
              </li>
            </div>
          )}
        </ul>
      </Sidebar>
    </div>
  );
};

export default Navbar;
