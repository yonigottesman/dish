'use client';

import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User, AuthState, SignupData, signup } from '../services/auth';
import { ApiService } from '../services/api';
import { getStoredUser, storeUser } from '../utils/authStorage';

// Re-export storeUser for convenience
export { storeUser } from '../utils/authStorage';

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<boolean>;
  signup: (data: SignupData) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<boolean>;
  setUser: (user: User | null) => void;
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
  logout: async () => false,
  setUser: () => {}
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authState, setAuthState] = useState<AuthState>(defaultAuthState);
  const router = useRouter();
  const pathname = usePathname();

  // Check authentication from localStorage on mount (no API call)
  useEffect(() => {
    // Check if we're on the login page
    if (pathname === '/login') {
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null
      });
      return;
    }

    // Read user from localStorage
    const storedUser = getStoredUser();

    if (storedUser) {
      // User found in localStorage - consider authenticated
      // If token is actually expired, API calls will return 401 and redirect
      setAuthState({
        isAuthenticated: true,
        user: storedUser,
        isLoading: false,
        error: null
      });
    } else {
      // No stored user - redirect to login
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null
      });
      router.push('/login');
    }
  }, [pathname, router]);

  // Helper to update user state
  const setUser = (user: User | null) => {
    storeUser(user);
    setAuthState(prev => ({
      ...prev,
      isAuthenticated: !!user,
      user
    }));
  };
  
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
        // Auth successful - get user from response
        const data = await response.json();
        const user = data.user ? {
          username: data.user.username,
          email: data.user.email,
          full_name: data.user.full_name,
        } : null;

        // Store user in localStorage
        storeUser(user);

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

    // Clear localStorage first
    storeUser(null);

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
        // Signup was successful - store user in localStorage
        storeUser(result.user);

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
      logout: handleLogout,
      setUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};