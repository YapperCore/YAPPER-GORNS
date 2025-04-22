"use client";

import React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "primereact/button";
import { Sidebar } from "primereact/sidebar";
import { useState } from "react";
import "../styles/Navbar.css";

const navLinks = [
  {
    href: "/home",
    label: "Home",
    icon: "pi pi-home",
  },
  {
    href: "/documents",
    label: "Documents",
    icon: "pi pi-file",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: "pi pi-cog",
  },
  {
    href: "/trash",
    label: "Trash",
    icon: "pi pi-trash",
  },
];

const Navbar = () => {
  const { currentUser, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  // Hide Navbar on /login and /signup
  if (pathname === "/login" || pathname === "/signup") {
    return null;
  }

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
      <Sidebar
        visible={visible}
        onHide={() => setVisible(false)}
        style={{
          height: "100vh",
          maxHeight: "100vh",
          top: 0,
          bottom: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          background: "#2e2b46", // light gray
        }}
        maskStyle={{
          zIndex: 1000,
        }}
      >
        <h1 className="logo" style={{ paddingLeft: "1.5rem" }}>Yapper</h1>
        <div
          className="sidebar-links-inner"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <ul
            className="sidebar-links"
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              minHeight: 0,
            }}
          >
            {currentUser ? (
              <>
                {navLinks.map((link) => (
                  <li key={link.href} style={{ paddingLeft: "1.5rem" }}>
                    <Link href={link.href} className="sidebar-link">
                      <i
                        className={link.icon}
                        style={{ marginRight: "0.75rem" }}
                      />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </>
            ) : (
              <div className="nav-buttons">
                <li style={{ paddingLeft: "1.5rem" }}>
                  <Link href="/login">
                    <Button
                      className="p-button-outlined p-button-sm"
                      label="Login"
                    />
                  </Link>
                </li>
                <li style={{ paddingLeft: "1.5rem" }}>
                  <Link href="/signup">
                    <Button className="p-button-sm" label="Sign Up" />
                  </Link>
                </li>
              </div>
            )}
          </ul>
          <hr className="sidebar-divider" />
          {currentUser && (
            <div className="sidebar-signout">
              <Button
                onClick={handleLogout}
                className="logout-btn p-button-danger p-button-sm"
                label="Logout"
                icon="pi pi-sign-out"
              />
            </div>
          )}
        </div>
      </Sidebar>  
    </div>
  );
};

export default Navbar;
