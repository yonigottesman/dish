import { buildApiUrl, API_CONFIG } from '../config/api';

// Type definitions for authentication
export interface User {
  username: string;
  email?: string;
  full_name?: string;
}

export interface SignupData {
  username: string;
  password: string;
  email?: string;
  full_name?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  error: string | null;
}

// Check if the user is authenticated by making a request to the backend
export const checkAuthStatus = async (): Promise<User | null> => {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/`, {
      method: 'GET',
      credentials: 'include', // Important for cookies
    });

    if (response.ok) {
      // If we can successfully access the protected home endpoint, we're authenticated
      // Extract user data from response
      const data = await response.json();
      if (data.status === 'authenticated' && data.user) {
        return {
          username: data.user.username,
          email: data.user.email,
          full_name: data.user.full_name,
        };
      }
      return null;
    }

    return null;
  } catch (error) {
    console.error('Error checking auth status:', error);
    return null;
  }
};

// Signup function
export const signup = async (userData: SignupData): Promise<{ success: boolean; user?: User; error?: string }> => {
  try {
    console.log('Signup attempt:', userData.username);
    const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.SIGNUP), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    console.log('Signup response status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('Signup successful:', data);

      // Backend sets the cookie automatically, no need to set it manually
      return {
        success: true,
        user: data.user,
      };
    } else {
      let errorMsg = 'Signup failed';
      try {
        const errorData = await response.json();
        errorMsg = errorData.detail || 'Signup failed';
        console.error('Signup error details:', errorData);
      } catch (e) {
        console.error('Failed to parse error response:', e);
      }

      return {
        success: false,
        error: errorMsg,
      };
    }
  } catch (error) {
    console.error('Error during signup:', error);
    return {
      success: false,
      error: 'Network error during signup',
    };
  }
};

// Helper function to clear all auth cookies on client side
const clearClientCookies = () => {
  const cookiesToClear = ['access-token', 'access_token', 'access_token_cookie'];
  
  cookiesToClear.forEach(cookieName => {
    // Clear for current domain
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    // Clear for parent domain (in case of subdomain)
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
    // Clear with secure flag
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; secure;`;
    // Clear with samesite=none
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; secure; samesite=none;`;
  });
};

// Logout function
export const logout = async (): Promise<boolean> => {
  try {
    console.log('Attempting logout...');
    const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.LOGOUT), {
      method: 'GET',
      credentials: 'include',
    });

    console.log('Logout response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Logout response:', data);
    } else {
      console.warn('Logout request failed with status:', response.status);
      // Even if logout fails on server, we should still redirect to login
      // to clear any client-side state
    }

    // Clear cookies on client side as backup
    console.log('Clearing client-side cookies...');
    clearClientCookies();

    // Always redirect to login page after logout attempt
    // This ensures user is logged out even if server-side logout fails
    window.location.href = '/login';
    return true;
  } catch (error) {
    console.error('Error logging out:', error);
    
    // Clear cookies on client side even if server request failed
    console.log('Clearing client-side cookies after error...');
    clearClientCookies();
    
    // Even if there's an error, we should still redirect to login
    // to clear any client-side state
    window.location.href = '/login';
    return true;
  }
};