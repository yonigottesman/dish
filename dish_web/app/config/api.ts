// API Configuration
export const API_CONFIG = {
  // Base URL for the API server
  // TODO: Replace with environment variable in production
  BASE_URL: 'http://127.0.2.2:8000',
  
  // API endpoints
  ENDPOINTS: {
    ALL_DISHES: '/all_dishes',
    DISH_BY_ID: '/dish',
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