<<<<<<< HEAD
import React from "react";
import { AuthProvider } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import { PrimeReactProvider } from "primereact/api";
import "../styles/global.css"; // Fixed path from globals.css to global.css

// PrimeReact styles
import "primereact/resources/themes/lara-light-indigo/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

export const metadata = {
  title: "Yapper - Audio Transcription App",
  description: "Transcribe and manage audio files with ease",
=======
import React from 'react';
import { AuthProvider } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import { PrimeReactProvider } from 'primereact/api';
import '../styles/global.css'; // Fixed path from globals.css to global.css

// PrimeReact styles
import 'primereact/resources/themes/lara-light-indigo/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';

export const metadata = {
  title: 'Yapper - Audio Transcription App',
  description: 'Transcribe and manage audio files with ease',
>>>>>>> SCRUM-4-spike-on-ACM-vs-nginx
};

export default function RootLayout({
  children,
}: {
<<<<<<< HEAD
  children: React.ReactNode;
=======
  children: React.ReactNode
>>>>>>> SCRUM-4-spike-on-ACM-vs-nginx
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <PrimeReactProvider>
            <div className="app-container">
              <Navbar />
<<<<<<< HEAD
              <main>{children}</main>
=======
              <main>
                {children}
              </main>
>>>>>>> SCRUM-4-spike-on-ACM-vs-nginx
            </div>
          </PrimeReactProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
