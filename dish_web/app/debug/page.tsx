'use client';

import { useState, useEffect } from 'react';
import { buildApiUrl, API_CONFIG } from '../config/api';

// Helper function to get all cookies
const getAllCookies = () => {
  if (typeof document === 'undefined') {
    return {};
  }
  const cookies = document.cookie.split(';').reduce((acc, cookie) => {
    const [name, value] = cookie.trim().split('=');
    acc[name] = value;
    return acc;
  }, {} as Record<string, string>);
  return cookies;
};

// Helper function to get localStorage data
const getLocalStorageData = () => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
    return {};
  }
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      data[key] = localStorage.getItem(key) || '';
    }
  }
  return data;
};

export default function DebugPage() {
  const [cookies, setCookies] = useState<Record<string, string>>({});
  const [localStorageData, setLocalStorageData] = useState<Record<string, string>>({});
  const [userAgent, setUserAgent] = useState('');
  const [authStatus, setAuthStatus] = useState<any>(null);
  const [authError, setAuthError] = useState<string>('');

  useEffect(() => {
    // Get browser info
    setUserAgent(navigator.userAgent);
    
    // Get cookies and localStorage
    setCookies(getAllCookies());
    setLocalStorageData(getLocalStorageData());
    
    // Test auth status
    testAuthStatus();
  }, []);

  const testAuthStatus = async () => {
    try {
      // Try with cookies only (normal approach)
      const response1 = await fetch(`${API_CONFIG.BASE_URL}/`, {
        method: 'GET',
        credentials: 'include',
      });

      if (response1.ok) {
        const data = await response1.json();
        setAuthStatus({ type: 'cookie', success: true, data });
        return;
      }

      // Try with localStorage token in header
      const storedToken = typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function' 
        ? localStorage.getItem('auth-token') 
        : null;
      if (storedToken) {
        const response2 = await fetch(`${API_CONFIG.BASE_URL}/`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Authorization': storedToken,
          },
        });

        if (response2.ok) {
          const data = await response2.json();
          setAuthStatus({ type: 'localStorage', success: true, data });
          return;
        }
      }

      setAuthStatus({ success: false });
    } catch (error) {
      setAuthError(String(error));
    }
  };

  const clearAll = () => {
    // Clear cookies
    Object.keys(cookies).forEach(cookieName => {
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; secure;`;
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; secure; samesite=none;`;
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; secure; samesite=lax;`;
    });
    
    // Clear localStorage
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined' && typeof window.localStorage.clear === 'function') {
      window.localStorage.clear();
    }
    
    // Refresh data
    setCookies(getAllCookies());
    setLocalStorageData(getLocalStorageData());
    setAuthStatus(null);
    setAuthError('');
  };

  const isMobileSafari = /iPhone|iPad/.test(userAgent) && /Safari/.test(userAgent) && !/Chrome/.test(userAgent);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Authentication Debug Page</h1>
      
      <div className="space-y-6">
        {/* Browser Info */}
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-semibold mb-2">Browser Info</h2>
          <p><strong>User Agent:</strong> {userAgent}</p>
          <p><strong>Mobile Safari:</strong> {isMobileSafari ? 'Yes' : 'No'}</p>
          <p><strong>Base URL:</strong> {API_CONFIG.BASE_URL}</p>
        </div>

        {/* Cookies */}
        <div className="bg-blue-50 p-4 rounded">
          <h2 className="font-semibold mb-2">Cookies</h2>
          {Object.keys(cookies).length > 0 ? (
            <pre className="text-sm bg-white p-2 rounded">
              {JSON.stringify(cookies, null, 2)}
            </pre>
          ) : (
            <p className="text-gray-500">No cookies found</p>
          )}
        </div>

        {/* localStorage */}
        <div className="bg-green-50 p-4 rounded">
          <h2 className="font-semibold mb-2">localStorage</h2>
          {Object.keys(localStorageData).length > 0 ? (
            <pre className="text-sm bg-white p-2 rounded">
              {JSON.stringify(localStorageData, null, 2)}
            </pre>
          ) : (
            <p className="text-gray-500">No localStorage data found</p>
          )}
        </div>

        {/* Auth Status */}
        <div className="bg-yellow-50 p-4 rounded">
          <h2 className="font-semibold mb-2">Authentication Status</h2>
          {authStatus ? (
            <div>
              <p><strong>Success:</strong> {authStatus.success ? 'Yes' : 'No'}</p>
              {authStatus.type && <p><strong>Method:</strong> {authStatus.type}</p>}
              {authStatus.data && (
                <pre className="text-sm bg-white p-2 rounded mt-2">
                  {JSON.stringify(authStatus.data, null, 2)}
                </pre>
              )}
            </div>
          ) : (
            <p className="text-gray-500">Testing...</p>
          )}
          {authError && (
            <p className="text-red-600 mt-2"><strong>Error:</strong> {authError}</p>
          )}
        </div>

        {/* Actions */}
        <div className="space-x-4">
          <button
            onClick={testAuthStatus}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Test Auth Status
          </button>
          <button
            onClick={clearAll}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Clear All Data
          </button>
          <button
            onClick={() => window.location.href = '/login'}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Go to Login
          </button>
        </div>
      </div>
    </div>
  );
} 