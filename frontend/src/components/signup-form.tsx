// src/app/signup/page.tsx
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

export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { currentUser, signup } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (currentUser) {
      router.push("/home");
    }
  }, [currentUser, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password || !confirmPassword) {
      toast({
        title: "Signup Error",
        description: "Please fill out all fields",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Signup Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Signup Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      await signup(email, password);

      toast({
        title: "Signup Successful",
        description: "Your account has been created successfully",
        variant: "success",
      });

      router.push("/home");
    } catch (err: any) {
      console.error("Signup failed:", err);

      let errorMessage = "Failed to sign up. Please try again.";
      if (err.code) {
        switch (err.code) {
          case "auth/email-already-in-use":
            errorMessage = "This email is already registered.";
            break;
          case "auth/invalid-email":
            errorMessage = "Invalid email format";
            break;
          case "auth/weak-password":
            errorMessage =
              "Password is too weak. Please use a stronger password.";
            break;
          default:
            errorMessage = `Failed to sign up: ${err.message}`;
        }
      }

      toast({
        title: "Signup Failed",
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
                <h1 className="text-2xl font-bold">Create an Account</h1>
                <p className="text-balance text-muted-foreground">
                  Sign up to join Yapper
                </p>
              </div>

              {/* Email */}
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="rounded-full"
                  required
                />
              </div>

              {/* Password */}
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="rounded-full"
                  required
                />
              </div>

              {/* Confirm Password */}
              <div className="grid gap-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="rounded-full"
                  required
                />
              </div>

              {/* Submit Button */}
              <Button asChild>
                <button
                  type="submit"
                  className="!inline-flex !items-center !justify-center !rounded-full !text-sm !font-medium !transition-colors !focus-visible:outline-none !focus-visible:ring-2 !focus-visible:ring-ring !focus-visible:ring-offset-2 !disabled:opacity-50 !disabled:pointer-events-none !ring-offset-background !bg-black !text-orange-500 !hover:bg-black/90 !h-10 !px-4 !py-2 !w-full"
                  disabled={loading}
                >
                  {loading ? "Signing up..." : "Sign Up"}
                </button>
              </Button>

              {/* Or divider */}
              <div className="relative text-center text-sm">
                <span className="relative z-10 bg-background px-2 text-muted-foreground rounded-full">
                  Or continue with
                </span>
              </div>

              {/* Google Sign In Button */}
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

              {/* Login Link */}
              <div className="text-center text-sm mt-4">
                Already have an account?{" "}
                <a
                  href="/login"
                  className="underline underline-offset-4 text-black"
                >
                  Login
                </a>
              </div>
            </div>
          </form>

          {/* Side image */}
          <div className="relative hidden bg-muted md:block rounded-lg">
            <img
              src="/static/Yapperlogoimg.png"
              alt="Yapper Logo"
              className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale rounded-lg"
            />
          </div>
        </CardContent>
      </Card>

      {/* Terms & Policy */}
      <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-primary">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </div>
    </div>
  );
}
