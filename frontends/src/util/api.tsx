// src/pages/api.tsx
"use client";

import { useAuth } from "../context/AuthContext";

/**
 * Custom hook for making authenticated API requests
 */
export function useApi() {
  const { currentUser, getIdToken } = useAuth();

  /**
   * Make an authenticated API request
   */
  async function authFetch(
    url: string,
    options: RequestInit = {}
  ): Promise<any> {
    try {
      let token: string | null = null;
      if (getIdToken) {
        token = await getIdToken();
      }

      const headers: Record<string, string> = {
        ...(options.headers as Record<string, string>),
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      if (currentUser) {
        headers["X-User-ID"] = currentUser.uid;
      }

      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request error (${url}):`, error);
      throw error;
    }
  }

  async function get(url: string) {
    return authFetch(url);
  }

  async function post(url: string, data: any) {
    return authFetch(url, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async function put(url: string, data: any) {
    return authFetch(url, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async function del(url: string) {
    return authFetch(url, {
      method: "DELETE",
    });
  }

  /**
   * Upload a file with authentication
   */
  async function uploadFile(
    url: string,
    file: File,
    extraData: Record<string, any> = {}
  ): Promise<any> {
    try {
      let token: string | null = null;
      if (getIdToken) {
        token = await getIdToken();
      }

      const formData = new FormData();
      formData.append("audio", file);

      Object.entries(extraData).forEach(([key, value]) => {
        formData.append(key, value);
      });

      const headers: Record<string, string> = {};

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      if (currentUser) {
        headers["X-User-ID"] = currentUser.uid;
      }

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`File upload error (${url}):`, error);
      throw error;
    }
  }

  return {
    get,
    post,
    put,
    delete: del,
    uploadFile,
    currentUserId: currentUser?.uid,
    isAuthenticated: !!currentUser,
  };
}
