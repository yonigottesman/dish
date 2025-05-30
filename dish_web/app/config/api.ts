// API Configuration
export const API_CONFIG = {
  // Base URL for the API server
  // Use environment variable or fallback to default
  BASE_URL: typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL
    : 'http://localhost:8000',

  // Frontend URL for redirects
  FRONTEND_URL: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',

  // API endpoints
  ENDPOINTS: {
    // Recipe endpoints
    ALL_DISHES: '/all_dishes',
    DISH_BY_ID: '/dish',
    ADD_DISH_FROM_LINK: '/add_dish_from_link',
    SAVE_EDIT: '/save_edit',

    // Auth endpoints
    LOGIN: '/token',
    LOGOUT: '/logout',
    SIGNUP: '/signup',
    GOOGLE_LOGIN: '/login/google',
    AUTH: '/auth'
  }
} as const;

// Helper function to build full API URLs
export const buildApiUrl = (endpoint: string, params?: string | number): string => {
  const baseUrl = API_CONFIG.BASE_URL;
  if (params) {
    return `${baseUrl}${endpoint}/${params}`;
  }
  return `${baseUrl}${endpoint}`;
}; 