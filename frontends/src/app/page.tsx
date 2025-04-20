"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Login from "./login/page";

export default function IndexPage() {
  const router = useRouter();
  const { currentUser, loading } = useAuth();

  useEffect(() => {
    if (!loading && currentUser) {
      router.replace("/home");
    }
  }, [loading, currentUser, router]);

  if (loading) return <div>Loading...</div>;

  return <Login />;
}
