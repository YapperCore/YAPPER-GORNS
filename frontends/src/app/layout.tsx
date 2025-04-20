// src/app/layout.tsx
import "../static/App.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata = {
  title: "Your App",
  description: "Auto-transcription App",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
