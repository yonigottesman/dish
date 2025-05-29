'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { ApiService, Recipe } from '../../services/api';

export default function RecipePage() {
  const params = useParams();
  const recipeId = params.id as string;
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [checkedInstructions, setCheckedInstructions] = useState<Set<number>>(new Set());

  const toggleIngredient = (index: number) => {
    const newChecked = new Set(checkedIngredients);
    if (newChecked.has(index)) {
      newChecked.delete(index);
    } else {
      newChecked.add(index);
    }
    setCheckedIngredients(newChecked);
  };

  const toggleInstruction = (index: number) => {
    const newChecked = new Set(checkedInstructions);
    if (newChecked.has(index)) {
      newChecked.delete(index);
    } else {
      newChecked.add(index);
    }
    setCheckedInstructions(newChecked);
  };

  useEffect(() => {
    const fetchRecipe = async () => {
      try {
        setLoading(true);
        const fetchedRecipe = await ApiService.getRecipeById(recipeId);
        setRecipe(fetchedRecipe);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch recipe:', err);
        setError('Failed to load recipe. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (recipeId) {
      fetchRecipe();
    }
  }, [recipeId]);

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        padding: '40px 20px',
        background: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            fontSize: '18px', 
            color: '#787774',
            marginBottom: '16px'
          }}>
            Loading recipe...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        padding: '40px 20px',
        background: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            fontSize: '18px', 
            color: '#e74c3c',
            marginBottom: '16px'
          }}>
            {error}
          </div>
          <Link 
            href="/"
            style={{
              display: 'inline-block',
              padding: '8px 16px',
              background: '#37352f',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '3px',
              fontSize: '14px'
            }}
          >
            Back to Recipes
          </Link>
        </div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        padding: '40px 20px',
        background: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '24px', color: '#37352f', marginBottom: '16px' }}>Recipe Not Found</h1>
          <p style={{ color: '#787774', marginBottom: '24px' }}>The recipe you're looking for doesn't exist.</p>
          <Link 
            href="/"
            style={{
              display: 'inline-block',
              padding: '8px 16px',
              background: '#37352f',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '3px',
              fontSize: '14px'
            }}
          >
            Back to Recipes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Navigation Bar */}
      <nav style={{
        background: '#f7f6f3',
        borderBottom: '1px solid #e9e9e7',
        padding: '12px 20px'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', alignItems: 'center' }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '8px 16px',
              background: '#37352f',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '3px',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Home
          </Link>
        </div>
      </nav>

      <div style={{ padding: '40px 20px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        <div style={{ marginBottom: '32px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <span style={{ fontSize: '32px' }}>🍽️</span>
            <h1 style={{ 
              fontSize: '32px', 
              fontWeight: '600', 
              color: '#37352f',
              margin: '0'
            }}>
              {recipe.title}
            </h1>
          </div>
          
          <p style={{ 
            fontSize: '16px', 
            color: '#787774',
            lineHeight: '1.6',
            margin: '0'
          }}>
            {recipe.description}
          </p>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '32px' 
        }}>
          <div>
            <h2 style={{ 
              fontSize: '18px', 
              fontWeight: '600', 
              color: '#37352f', 
              marginBottom: '16px',
              margin: '0 0 16px 0'
            }}>
              Ingredients
            </h2>
            <div style={{ 
              background: '#f7f6f3', 
              borderRadius: '3px', 
              padding: '16px',
              border: '1px solid #e9e9e7'
            }}>
              <ul style={{ 
                listStyle: 'none', 
                padding: '0', 
                margin: '0' 
              }}>
                {recipe.ingredients.map((ingredient, index) => (
                  <li key={index} style={{ 
                    padding: '8px 0', 
                    borderBottom: index < recipe.ingredients.length - 1 ? '1px solid #e9e9e7' : 'none',
                    fontSize: '14px',
                    color: '#37352f',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <input
                      type="checkbox"
                      checked={checkedIngredients.has(index)}
                      onChange={() => toggleIngredient(index)}
                      style={{
                        width: '16px',
                        height: '16px',
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                    />
                    <span style={{ 
                      textDecoration: checkedIngredients.has(index) ? 'line-through' : 'none',
                      opacity: checkedIngredients.has(index) ? 0.6 : 1,
                      transition: 'all 0.2s ease'
                    }}>
                      {ingredient}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <h2 style={{ 
              fontSize: '18px', 
              fontWeight: '600', 
              color: '#37352f', 
              marginBottom: '16px',
              margin: '0 0 16px 0'
            }}>
              Instructions
            </h2>
            <div style={{ 
              background: '#f7f6f3', 
              borderRadius: '3px', 
              padding: '16px',
              border: '1px solid #e9e9e7'
            }}>
              <ol style={{ 
                listStyle: 'none', 
                padding: '0', 
                margin: '0' 
              }}>
                {recipe.instructions.map((instruction, index) => (
                  <li key={index} style={{ 
                    padding: '12px 0', 
                    borderBottom: index < recipe.instructions.length - 1 ? '1px solid #e9e9e7' : 'none',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    color: '#37352f'
                  }}>
                    <input
                      type="checkbox"
                      checked={checkedInstructions.has(index)}
                      onChange={() => toggleInstruction(index)}
                      style={{
                        width: '16px',
                        height: '16px',
                        cursor: 'pointer',
                        flexShrink: 0,
                        marginTop: '2px'
                      }}
                    />
                    <span style={{ 
                      minWidth: '20px',
                      height: '20px',
                      background: checkedInstructions.has(index) ? '#9ca3af' : '#37352f',
                      color: 'white',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: '500',
                      flexShrink: 0,
                      marginTop: '2px',
                      transition: 'all 0.2s ease'
                    }}>
                      {index + 1}
                    </span>
                    <span style={{ 
                      textDecoration: checkedInstructions.has(index) ? 'line-through' : 'none',
                      opacity: checkedInstructions.has(index) ? 0.6 : 1,
                      transition: 'all 0.2s ease'
                    }}>
                      {instruction}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
} 