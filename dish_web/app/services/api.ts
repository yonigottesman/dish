import { API_CONFIG, buildApiUrl } from '../config/api';

// Recipe interface to match the backend data structure
export interface Recipe {
  dish_id: string;
  title: string;
  description: string;
  ingredients: string[];
  instructions: string[];
}

// API service class
export class ApiService {
  /**
   * Fetch all recipes from the backend
   */
  static async getAllRecipes(): Promise<Recipe[]> {
    try {
      const url = buildApiUrl(API_CONFIG.ENDPOINTS.ALL_DISHES);
      console.log(`Fetching all recipes from: ${url}`); // Debug log
      
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const recipes: Recipe[] = await response.json();
      console.log(`Successfully fetched ${recipes.length} recipes`); // Debug log
      return recipes;
    } catch (error) {
      console.error('Error fetching all recipes:', error);
      console.error(`URL attempted: ${buildApiUrl(API_CONFIG.ENDPOINTS.ALL_DISHES)}`);
      throw error;
    }
  }

  /**
   * Fetch a specific recipe by ID from the backend
   */
  static async getRecipeById(id: string): Promise<Recipe | null> {
    try {
      const url = buildApiUrl(API_CONFIG.ENDPOINTS.DISH_BY_ID, id);
      console.log(`Fetching recipe from: ${url}`); // Debug log
      
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          return null; // Recipe not found
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const recipe: Recipe = await response.json();
      console.log(`Successfully fetched recipe:`, recipe); // Debug log
      return recipe;
    } catch (error) {
      console.error(`Error fetching recipe with ID ${id}:`, error);
      console.error(`URL attempted: ${buildApiUrl(API_CONFIG.ENDPOINTS.DISH_BY_ID, id)}`);
      throw error;
    }
  }
} 