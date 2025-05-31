'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { ApiService, Recipe } from '../../services/api';
import { useAuth } from '../../context/auth-context';
import ProtectedRoute from '../../components/protected-route';
import Navbar from '../../components/navbar';

// Component to display recipe images
function RecipeImages({ imageIds, isEditing, onDeleteImage }: { 
  imageIds: string[];
  isEditing?: boolean;
  onDeleteImage?: (imageId: string) => void;
}) {
  if (!imageIds || imageIds.length === 0) {
    return null;
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: imageIds.length === 1 
        ? '1fr' 
        : imageIds.length === 2 
          ? 'repeat(2, 1fr)' 
          : 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '12px',
      maxHeight: imageIds.length > 4 ? '400px' : 'auto',
      overflowY: imageIds.length > 4 ? 'auto' : 'visible',
      marginBottom: '32px'
    }}>
      {imageIds.map((imageId, index) => (
        <div
          key={imageId}
          style={{
            position: 'relative',
            borderRadius: '6px',
            overflow: 'hidden',
            border: '1px solid #e9e9e7',
            background: '#ffffff',
            aspectRatio: '16/9',
            cursor: 'pointer',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.02)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          onClick={() => {
            // Open image in new tab for full size viewing
            window.open(ApiService.getImageUrl(imageId), '_blank');
          }}
        >
          <img
            src={ApiService.getImageUrl(imageId)}
            alt={`Recipe image ${index + 1}`}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block'
            }}
            onError={(e) => {
              // Show placeholder for broken images
              const target = e.currentTarget;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = `
                  <div style="
                    width: 100%; 
                    height: 100%; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    background: #f0f0f0; 
                    color: #999;
                    font-size: 14px;
                  ">
                    Image not available
                  </div>
                `;
              }
            }}
          />
          {isEditing && onDeleteImage && (
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent opening image when clicking delete
                onDeleteImage(imageId);
              }}
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: '#e74c3c',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#c0392b';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#e74c3c';
              }}
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

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
  
  // Add states for image upload
  const [newImages, setNewImages] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);

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
    // Clear new images when canceling
    setNewImages([]);
    setNewImagePreviews([]);
  };

  const handleSave = async () => {
    if (!editedRecipe || !recipe) return;

    try {
      setIsSaving(true);
      const savedRecipe = await ApiService.saveEditedRecipe(recipeId, editedRecipe, recipe, newImages);
      setRecipe(savedRecipe);
      setEditedRecipe(null);
      setIsEditing(false);
      // Clear new images after successful save
      setNewImages([]);
      setNewImagePreviews([]);
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

  const removeImage = (imageId: string) => {
    if (editedRecipe && editedRecipe.image_ids) {
      setEditedRecipe({
        ...editedRecipe,
        image_ids: editedRecipe.image_ids.filter(id => id !== imageId)
      });
    }
  };

  // Add function to handle new image uploads
  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      setNewImages(prev => [...prev, ...files]);
      
      // Create preview URLs
      const previews = files.map(file => URL.createObjectURL(file));
      setNewImagePreviews(prev => [...prev, ...previews]);
    }
  };

  const removeNewImage = (index: number) => {
    setNewImages(prev => prev.filter((_, i) => i !== index));
    setNewImagePreviews(prev => {
      // Clean up the URL object
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
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
  
  // Check if the recipe language is Hebrew for RTL text direction
  const isHebrew = displayRecipe.language === 'he';

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
            marginBottom: '16px',
            flexDirection: isHebrew ? 'row-reverse' : 'row'
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
                    background: '#ffffff',
                    direction: isHebrew ? 'rtl' : 'ltr',
                    textAlign: isHebrew ? 'right' : 'left'
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
                  margin: '0',
                  direction: isHebrew ? 'rtl' : 'ltr',
                  textAlign: isHebrew ? 'right' : 'left'
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
                background: '#ffffff',
                direction: isHebrew ? 'rtl' : 'ltr',
                textAlign: isHebrew ? 'right' : 'left'
              }}
            />
          ) : (
            <p style={{ 
              fontSize: '16px', 
              color: '#787774',
              lineHeight: '1.6',
              margin: '0',
              direction: isHebrew ? 'rtl' : 'ltr',
              textAlign: isHebrew ? 'right' : 'left'
            }}>
              {displayRecipe.description}
            </p>
          )}

          {/* Language Selection - Only shown in edit mode */}
          {isEditing && (
            <div style={{
              marginTop: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexDirection: isHebrew ? 'row-reverse' : 'row'
            }}>
              <label style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#37352f',
                minWidth: '70px'
              }}>
                Language:
              </label>
              <select
                value={displayRecipe.language || 'en'}
                onChange={(e) => updateEditedField('language', e.target.value)}
                style={{
                  padding: '6px 8px',
                  border: '1px solid #e9e9e7',
                  borderRadius: '4px',
                  fontSize: '14px',
                  background: '#ffffff',
                  cursor: 'pointer',
                  minWidth: '120px'
                }}
              >
                <option value="en">English</option>
                <option value="he">עברית (Hebrew)</option>
              </select>
            </div>
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

        {/* Display recipe images if they exist */}
        <RecipeImages imageIds={displayRecipe.image_ids || []} isEditing={isEditing} onDeleteImage={removeImage} />

        {/* Image Upload Section - Only show in edit mode */}
        {isEditing && (
          <div style={{ marginBottom: '32px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              <h3 style={{ 
                fontSize: '18px', 
                fontWeight: '600', 
                color: '#37352f',
                margin: '0'
              }}>
                Add New Images
              </h3>
            </div>
            
            {/* File Upload Area */}
            <div style={{
              border: '2px dashed #e9e9e7',
              borderRadius: '8px',
              padding: '20px',
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: newImages.length > 0 ? '#f7f6f3' : 'transparent',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '120px',
              marginBottom: '16px'
            }}
            onClick={() => document.getElementById('edit-image-upload')?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = '#37352f';
              e.currentTarget.style.backgroundColor = '#f7f6f3';
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = '#e9e9e7';
              e.currentTarget.style.backgroundColor = newImages.length > 0 ? '#f7f6f3' : 'transparent';
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = '#e9e9e7';
              e.currentTarget.style.backgroundColor = newImages.length > 0 ? '#f7f6f3' : 'transparent';
              
              const files = Array.from(e.dataTransfer.files);
              const imageFiles = files.filter(file => file.type.startsWith('image/'));
              if (imageFiles.length > 0) {
                setNewImages(prev => [...prev, ...imageFiles]);
                const previews = imageFiles.map(file => URL.createObjectURL(file));
                setNewImagePreviews(prev => [...prev, ...previews]);
              }
            }}
            >
              <input
                id="edit-image-upload"
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                style={{ display: 'none' }}
                disabled={isSaving}
              />
              
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}>
                <div style={{
                  fontSize: '24px',
                  color: '#ccc',
                }}>
                  📸
                </div>
                <div style={{
                  fontSize: '14px',
                  color: '#666',
                  fontWeight: '500',
                }}>
                  Upload New Images
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#999',
                }}>
                  Click or drag images here (multiple files supported)
                </div>
              </div>
            </div>

            {/* Preview new images */}
            {newImages.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '12px',
                marginBottom: '16px'
              }}>
                {newImagePreviews.map((preview, index) => (
                  <div
                    key={index}
                    style={{
                      position: 'relative',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      border: '1px solid #e9e9e7',
                      background: '#ffffff',
                      aspectRatio: '16/9'
                    }}
                  >
                    <img
                      src={preview}
                      alt={`New image ${index + 1}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block'
                      }}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeNewImage(index);
                      }}
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: '#e74c3c',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
              border: isEditing ? '2px solid #27ae60' : '1px solid #e9e9e7',
              direction: isHebrew ? 'rtl' : 'ltr'
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
              border: isEditing ? '2px solid #27ae60' : '1px solid #e9e9e7',
              direction: isHebrew ? 'rtl' : 'ltr'
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