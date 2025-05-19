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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <PrimeReactProvider>
            <div className="app-container">
              <Navbar />
              <main>{children}</main>
            </div>
          </PrimeReactProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
