// src/util/api.js
import { useAuth } from '../context/AuthContext';

/**
 * Custom hook for making authenticated API requests
 */
export function useApi() {
  const { currentUser, getAuthToken } = useAuth();
  
  /**
   * Make an authenticated API request
   */
  async function authFetch(url, options = {}) {
    try {
      // Get auth token if available
      let token = null;
      if (getAuthToken) {
        token = await getAuthToken();
      }
      
      // Set up headers
      const headers = { 
        ...options.headers,
        'Content-Type': 'application/json'
      };
      
      // Add auth headers if user is logged in
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      if (currentUser) {
        headers['X-User-ID'] = currentUser.uid;
      }
      
      // Make the request
      const response = await fetch(url, {
        ...options,
        headers
      });
      
      // Handle errors
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      
      // Parse and return the response
      return await response.json();
    } catch (error) {
      console.error(`API request error (${url}):`, error);
      throw error;
    }
  }
  
  // API method helpers
  async function get(url) {
    return authFetch(url);
  }
  
  async function post(url, data) {
    return authFetch(url, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  async function put(url, data) {
    return authFetch(url, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }
  
  async function del(url) {
    return authFetch(url, {
      method: 'DELETE'
    });
  }
  
  /**
   * Upload a file with authentication
   */
  async function uploadFile(url, file, extraData = {}) {
    try {
      // Get auth token if available
      let token = null;
      if (getAuthToken) {
        token = await getAuthToken();
      }
      
      // Create form data
      const formData = new FormData();
      formData.append('audio', file);
      
      // Add any extra data
      Object.entries(extraData).forEach(([key, value]) => {
        formData.append(key, value);
      });
      
      // Set up headers
      const headers = {};
      
      // Add auth headers if user is logged in
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      if (currentUser) {
        headers['X-User-ID'] = currentUser.uid;
      }
      
      // Make the request
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData
      });
      
      // Handle errors
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      
      // Parse and return the response
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
    isAuthenticated: !!currentUser
  };
}
