'use client';

import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User, AuthState, SignupData, checkAuthStatus, signup } from '../services/auth';
import { ApiService } from '../services/api';

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<boolean>;
  signup: (data: SignupData) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<boolean>;
}

const defaultAuthState: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  user: null,
  error: null
};

const AuthContext = createContext<AuthContextType>({
  ...defaultAuthState,
  login: async () => false,
  signup: async () => ({ success: false }),
  logout: async () => false
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authState, setAuthState] = useState<AuthState>(defaultAuthState);
  const router = useRouter();
  const pathname = usePathname();

  // Check authentication status on mount
  useEffect(() => {
    const verifyAuth = async () => {
      try {
        // Check if we're already on the login page to avoid redirect loops
        if (pathname === '/login') {
          setAuthState({
            isAuthenticated: false,
            user: null,
            isLoading: false,
            error: null
          });
          return;
        }

        const user = await checkAuthStatus();

        setAuthState({
          isAuthenticated: !!user,
          user,
          isLoading: false,
          error: null
        });

        // If not authenticated and not on login page, redirect to login
        if (!user && pathname !== '/login') {
          router.push('/login');
        }

        // If authenticated and on login page, redirect to home
        if (user && pathname === '/login') {
          router.push('/');
        }
      } catch (error) {
        console.error('Auth verification error:', error);
        
        // Don't show error message when redirecting to login
        // This prevents the red error flash before redirect
        setAuthState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
          error: null  // Changed from 'Failed to verify authentication' to null
        });

        // Redirect to login on error if not already there
        if (pathname !== '/login') {
          router.push('/login');
        }
      }
    };

    verifyAuth();
  }, [pathname, router]);
  
  // Login function that will be exposed through context
  const login = async (username: string, password: string): Promise<boolean> => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);
      
      const response = await fetch('/api/token', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (response.ok) {
        // Auth successful
        const user = await checkAuthStatus();
        setAuthState({
          isAuthenticated: true,
          user,
          isLoading: false,
          error: null
        });
        
        router.push('/');
        return true;
      } else {
        // Auth failed
        const data = await response.json().catch(() => ({ detail: 'Login failed' }));
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          error: data.detail || 'Login failed'
        }));
        return false;
      }
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Network error. Please try again.'
      }));
      return false;
    }
  };
  
  // Logout function
  const handleLogout = async (): Promise<boolean> => {
    console.log('AuthContext: Starting logout process...');
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    const success = await ApiService.logout();
    
    if (success) {
      console.log('AuthContext: Logout successful, clearing state');
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null
      });
      
      // Force redirect to login page
      console.log('AuthContext: Redirecting to login page');
      window.location.href = '/login';
      return true;
    }
    
    console.log('AuthContext: Logout failed, keeping current state');
    setAuthState(prev => ({ ...prev, isLoading: false }));
    return false;
  };
  
  // Signup function
  const handleSignup = async (data: SignupData): Promise<{ success: boolean; error?: string }> => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await signup(data);

      if (result.success && result.user) {
        // Signup was successful
        setAuthState({
          isAuthenticated: true,
          user: result.user,
          isLoading: false,
          error: null
        });

        router.push('/');
        return { success: true };
      } else {
        // Signup failed
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          error: result.error || 'Signup failed'
        }));
        return { success: false, error: result.error };
      }
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Network error during signup'
      }));
      return { success: false, error: 'Network error during signup' };
    }
  };

  return (
    <AuthContext.Provider value={{
      ...authState,
      login,
      signup: handleSignup,
      logout: handleLogout
    }}>
      {children}
    </AuthContext.Provider>
  );
};