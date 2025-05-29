// src/app/login/page.tsx
"use client";

import { cn } from "../lib/utils";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useToast } from "../hooks/use-toast";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { currentUser, login } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (currentUser) {
      router.push("/home");
    }
  }, [currentUser, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast({
        title: "Login Error",
        description: "Please enter both email and password",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      await login(email, password);

      toast({
        title: "Login Successful",
        description: "You have been logged in successfully",
        variant: "success",
      });

      router.push("/home");
    } catch (err: any) {
      console.error("Login failed:", err);

      let errorMessage = "Failed to log in. Please check your credentials.";
      if (err.code) {
        switch (err.code) {
          case "auth/user-not-found":
          case "auth/wrong-password":
            errorMessage = "Invalid email or password";
            break;
          case "auth/invalid-email":
            errorMessage = "Invalid email format";
            break;
          case "auth/too-many-requests":
            errorMessage =
              "Too many failed login attempts. Please try again later.";
            break;
          default:
            errorMessage = `Failed to log in: ${err.message}`;
        }
      }

      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6")}>
      <Card className="overflow-hidden rounded-lg">
        <CardContent className="grid p-0 md:grid-cols-2 rounded-lg">
          <form className="p-6 md:p-8 rounded-lg" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center text-center">
                <h1 className="text-2xl font-bold">Welcome back</h1>
                <p className="text-balance text-muted-foreground">
                  Login to your Yapper account
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-full"
                  required
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  <a
                    href="#"
                    className="ml-auto text-sm underline-offset-2 hover:underline"
                  >
                    Forgot your password?
                  </a>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-full"
                  required
                />
              </div>
              <Button asChild>
                <button
                  type="submit"
                  className="!inline-flex !items-center !justify-center !rounded-full !text-sm !font-medium !transition-colors !focus-visible:outline-none !focus-visible:ring-2 !focus-visible:ring-ring !focus-visible:ring-offset-2 !disabled:opacity-50 !disabled:pointer-events-none !ring-offset-background !bg-black !text-orange-500 !hover:bg-black/90 !h-10 !px-4 !py-2 !w-full"
                  disabled={loading}
                >
                  {loading ? "Logging in..." : "Login"}
                </button>
              </Button>
              <div className="relative text-center text-sm">
                <span className="relative z-10 bg-background px-2 text-muted-foreground rounded-full">
                  Or continue with
                </span>
              </div>
              <div className="grid grid-cols-3">
                <div className="col-span-3 flex justify-center">
                  <Button className="rounded-full flex items-center justify-center">
                    <img
                      src="/static/google.png"
                      alt="Google Logo"
                      className="h-6 w-6"
                    />
                  </Button>
                </div>
              </div>
              <div className="text-center text-sm">
                Don&apos;t have an account?{" "}
                <a href="/signup" className="underline underline-offset-4">
                  Sign up
                </a>
              </div>
            </div>
          </form>
          <div className="relative hidden bg-muted md:block rounded-lg">
            <img
              src="/static/Yapperlogoimg.png"
              alt="Yapper Logo"
              className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale rounded-lg"
            />
          </div>
        </CardContent>
      </Card>
      <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-primary">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </div>
    </div>
  );
}
