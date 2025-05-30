'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { ApiService, Recipe } from '../../services/api';
import { useAuth } from '../../context/auth-context';
import ProtectedRoute from '../../components/protected-route';
import Navbar from '../../components/navbar';

export default function RecipePage() {
  const params = useParams();
  const recipeId = params.id as string;
  const { user } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [editedRecipe, setEditedRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [checkedInstructions, setCheckedInstructions] = useState<Set<number>>(new Set());
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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

  const handleEdit = () => {
    if (recipe) {
      setEditedRecipe({ ...recipe });
      setIsEditing(true);
    }
  };

  const handleCancel = () => {
    setEditedRecipe(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!editedRecipe) return;

    try {
      setIsSaving(true);
      const savedRecipe = await ApiService.saveEditedRecipe(recipeId, editedRecipe);
      setRecipe(savedRecipe);
      setEditedRecipe(null);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save recipe:', err);
      alert('Failed to save recipe. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateEditedField = (field: keyof Recipe, value: any) => {
    if (editedRecipe) {
      setEditedRecipe({ ...editedRecipe, [field]: value });
    }
  };

  const addIngredient = () => {
    if (editedRecipe) {
      setEditedRecipe({
        ...editedRecipe,
        ingredients: [...editedRecipe.ingredients, '']
      });
    }
  };

  const removeIngredient = (index: number) => {
    if (editedRecipe) {
      setEditedRecipe({
        ...editedRecipe,
        ingredients: editedRecipe.ingredients.filter((_, i) => i !== index)
      });
    }
  };

  const updateIngredient = (index: number, value: string) => {
    if (editedRecipe) {
      const newIngredients = [...editedRecipe.ingredients];
      newIngredients[index] = value;
      setEditedRecipe({
        ...editedRecipe,
        ingredients: newIngredients
      });
    }
  };

  const addInstruction = () => {
    if (editedRecipe) {
      setEditedRecipe({
        ...editedRecipe,
        instructions: [...editedRecipe.instructions, '']
      });
    }
  };

  const removeInstruction = (index: number) => {
    if (editedRecipe) {
      setEditedRecipe({
        ...editedRecipe,
        instructions: editedRecipe.instructions.filter((_, i) => i !== index)
      });
    }
  };

  const updateInstruction = (index: number, value: string) => {
    if (editedRecipe) {
      const newInstructions = [...editedRecipe.instructions];
      newInstructions[index] = value;
      setEditedRecipe({
        ...editedRecipe,
        instructions: newInstructions
      });
    }
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

  const displayRecipe = isEditing ? editedRecipe! : recipe;

  return (
    <ProtectedRoute>
      <div style={{
        minHeight: '100vh',
        background: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
      <Navbar />

      <div style={{ padding: '40px 20px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        <div style={{ 
          marginBottom: '32px',
          background: isEditing ? '#fff3cd' : 'transparent',
          border: isEditing ? '1px solid #ffeaa7' : 'none',
          borderRadius: isEditing ? '6px' : '0',
          padding: isEditing ? '16px' : '0'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            {isEditing ? (
              <>
                <input
                  type="text"
                  value={displayRecipe.emoji || ''}
                  onChange={(e) => updateEditedField('emoji', e.target.value)}
                  placeholder="🍽️"
                  style={{
                    fontSize: '32px',
                    width: '50px',
                    border: '1px solid #e9e9e7',
                    borderRadius: '4px',
                    padding: '4px',
                    textAlign: 'center'
                  }}
                />
                <input
                  type="text"
                  value={displayRecipe.title}
                  onChange={(e) => updateEditedField('title', e.target.value)}
                  style={{
                    fontSize: '32px',
                    fontWeight: '600',
                    color: '#37352f',
                    margin: '0',
                    border: '1px solid #e9e9e7',
                    borderRadius: '4px',
                    padding: '8px',
                    flex: 1,
                    background: '#ffffff'
                  }}
                />
              </>
            ) : (
              <>
                <span style={{ fontSize: '32px' }}>{displayRecipe.emoji || '🍽️'}</span>
                <h1 style={{ 
                  fontSize: '32px', 
                  fontWeight: '600', 
                  color: '#37352f',
                  margin: '0'
                }}>
                  {displayRecipe.title}
                </h1>
              </>
            )}
          </div>
          
          {isEditing ? (
            <textarea
              value={displayRecipe.description}
              onChange={(e) => updateEditedField('description', e.target.value)}
              style={{
                fontSize: '16px',
                color: '#787774',
                lineHeight: '1.6',
                margin: '0',
                width: '100%',
                minHeight: '60px',
                border: '1px solid #e9e9e7',
                borderRadius: '4px',
                padding: '8px',
                resize: 'vertical',
                background: '#ffffff'
              }}
            />
          ) : (
            <p style={{ 
              fontSize: '16px', 
              color: '#787774',
              lineHeight: '1.6',
              margin: '0'
            }}>
              {displayRecipe.description}
            </p>
          )}
          
          {recipe.link && (
            <div style={{
              marginTop: '16px',
              padding: '12px 16px',
              background: '#f1f9ff',
              border: '1px solid #d1e9ff',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '16px' }}>🔗</span>
              {isEditing ? (
                <input
                  type="url"
                  value={displayRecipe.link || ''}
                  onChange={(e) => updateEditedField('link', e.target.value)}
                  placeholder="https://example.com/recipe"
                  style={{
                    flex: 1,
                    border: '1px solid #d1e9ff',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '14px'
                  }}
                />
              ) : (
                <a
                  href={recipe.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#0066cc',
                    textDecoration: 'none',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.textDecoration = 'underline';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.textDecoration = 'none';
                  }}
                >
                  link
                </a>
              )}
            </div>
          )}
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '32px' 
        }}>
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              <h2 style={{ 
                fontSize: '18px', 
                fontWeight: '600', 
                color: '#37352f',
                margin: '0'
              }}>
                Ingredients
              </h2>
              {isEditing && (
                <button
                  onClick={addIngredient}
                  style={{
                    padding: '4px 8px',
                    background: '#27ae60',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  + Add
                </button>
              )}
            </div>
            <div style={{ 
              background: isEditing ? '#e8f5e8' : '#f7f6f3', 
              borderRadius: '3px', 
              padding: '16px',
              border: isEditing ? '2px solid #27ae60' : '1px solid #e9e9e7'
            }}>
              <ul style={{ 
                listStyle: 'none', 
                padding: '0', 
                margin: '0' 
              }}>
                {displayRecipe.ingredients.map((ingredient, index) => (
                  <li key={index} style={{ 
                    padding: '8px 0', 
                    borderBottom: index < displayRecipe.ingredients.length - 1 ? '1px solid #e9e9e7' : 'none',
                    fontSize: '14px',
                    color: '#37352f',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    {!isEditing && (
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
                    )}
                    {isEditing ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                        <input
                          type="text"
                          value={ingredient}
                          onChange={(e) => updateIngredient(index, e.target.value)}
                          style={{
                            flex: 1,
                            border: '1px solid #e9e9e7',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '14px'
                          }}
                        />
                        <button
                          onClick={() => removeIngredient(index)}
                          style={{
                            padding: '2px 6px',
                            background: '#e74c3c',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <span style={{ 
                        textDecoration: checkedIngredients.has(index) ? 'line-through' : 'none',
                        opacity: checkedIngredients.has(index) ? 0.6 : 1,
                        transition: 'all 0.2s ease'
                      }}>
                        {ingredient}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              <h2 style={{ 
                fontSize: '18px', 
                fontWeight: '600', 
                color: '#37352f',
                margin: '0'
              }}>
                Instructions
              </h2>
              {isEditing && (
                <button
                  onClick={addInstruction}
                  style={{
                    padding: '4px 8px',
                    background: '#27ae60',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  + Add
                </button>
              )}
            </div>
            <div style={{ 
              background: isEditing ? '#e8f5e8' : '#f7f6f3', 
              borderRadius: '3px', 
              padding: '16px',
              border: isEditing ? '2px solid #27ae60' : '1px solid #e9e9e7'
            }}>
              <ol style={{ 
                listStyle: 'none', 
                padding: '0', 
                margin: '0' 
              }}>
                {displayRecipe.instructions.map((instruction, index) => (
                  <li key={index} style={{ 
                    padding: '12px 0', 
                    borderBottom: index < displayRecipe.instructions.length - 1 ? '1px solid #e9e9e7' : 'none',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    color: '#37352f'
                  }}>
                    {!isEditing && (
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
                    )}
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
                    {isEditing ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                        <textarea
                          value={instruction}
                          onChange={(e) => updateInstruction(index, e.target.value)}
                          style={{
                            flex: 1,
                            border: '1px solid #e9e9e7',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '14px',
                            minHeight: '40px',
                            resize: 'vertical'
                          }}
                        />
                        <button
                          onClick={() => removeInstruction(index)}
                          style={{
                            padding: '2px 6px',
                            background: '#e74c3c',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            alignSelf: 'flex-start'
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <span style={{ 
                        textDecoration: checkedInstructions.has(index) ? 'line-through' : 'none',
                        opacity: checkedInstructions.has(index) ? 0.6 : 1,
                        transition: 'all 0.2s ease'
                      }}>
                        {instruction}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        {/* Edit Controls - Bottom of recipe */}
        <div style={{ 
          marginTop: '40px',
          padding: '20px',
          borderTop: '1px solid #e9e9e7',
          display: 'flex',
          justifyContent: 'flex-start',
          gap: '12px'
        }}>
          {!isEditing ? (
            <button
              onClick={handleEdit}
              style={{
                padding: '8px 16px',
                background: '#e67e22',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#d35400';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#e67e22';
              }}
            >
              Edit Recipe
            </button>
          ) : (
            <>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                style={{
                  padding: '8px 16px',
                  background: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  opacity: isSaving ? 0.6 : 1,
                  transition: 'background-color 0.2s ease'
                }}
                onMouseOver={(e) => {
                  if (!isSaving) {
                    e.currentTarget.style.backgroundColor = '#7f8c8d';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isSaving) {
                    e.currentTarget.style.backgroundColor = '#95a5a6';
                  }
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                style={{
                  padding: '8px 16px',
                  background: isSaving ? '#ccc' : '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseOver={(e) => {
                  if (!isSaving) {
                    e.currentTarget.style.backgroundColor = '#229954';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isSaving) {
                    e.currentTarget.style.backgroundColor = '#27ae60';
                  }
                }}
              >
                {isSaving && (
                  <div style={{
                    width: '12px',
                    height: '12px',
                    border: '2px solid transparent',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }} />
                )}
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          )}
        </div>

        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
    </ProtectedRoute>
  );
} 