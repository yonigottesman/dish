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
      return {
        username: data.username,
        email: data.email,
        full_name: data.full_name,
      };
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

      // If backend provides a token, store it
      if (data.access_token) {
        // Set the authorization cookie if not already set by server
        document.cookie = `access-token=Bearer ${data.access_token}; path=/; max-age=${30 * 60}; SameSite=Lax`;
      }

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

// Logout function
export const logout = async (): Promise<boolean> => {
  try {
    await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.LOGOUT), {
      method: 'GET',
      credentials: 'include',
    });

    // Redirect to login page
    window.location.href = '/login';
    return true;
  } catch (error) {
    console.error('Error logging out:', error);
    return false;
  }
};