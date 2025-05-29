import { API_CONFIG, buildApiUrl } from '../config/api';

// Recipe interface to match the backend data structure
export interface Recipe {
  dish_id: string;
  title: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  link?: string;
  emoji?: string;
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

  /**
   * Add a new dish from a URL link
   */
  static async addDishFromLink(link: string): Promise<Recipe> {
    try {
      const url = `${buildApiUrl(API_CONFIG.ENDPOINTS.ADD_DISH_FROM_LINK)}?link=${encodeURIComponent(link)}`;
      console.log(`Adding dish from link: ${url}`); // Debug log
      
      const response = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const recipe: Recipe = await response.json();
      console.log(`Successfully added recipe from link:`, recipe); // Debug log
      return recipe;
    } catch (error) {
      console.error(`Error adding dish from link ${link}:`, error);
      console.error(`URL attempted: ${buildApiUrl(API_CONFIG.ENDPOINTS.ADD_DISH_FROM_LINK)}`);
      throw error;
    }
  }

  /**
   * Save edited recipe
   */
  static async saveEditedRecipe(dishId: string, recipe: Recipe): Promise<Recipe> {
    try {
      const url = buildApiUrl(API_CONFIG.ENDPOINTS.SAVE_EDIT, dishId);
      console.log(`Saving edited recipe to: ${url}`); // Debug log
      
      const response = await fetch(url, {
        method: 'PUT',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(recipe),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const savedRecipe: Recipe = await response.json();
      console.log(`Successfully saved edited recipe:`, savedRecipe); // Debug log
      return savedRecipe;
    } catch (error) {
      console.error(`Error saving edited recipe with ID ${dishId}:`, error);
      console.error(`URL attempted: ${buildApiUrl(API_CONFIG.ENDPOINTS.SAVE_EDIT, dishId)}`);
      throw error;
    }
  }
} 