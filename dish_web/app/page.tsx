'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { ApiService, Recipe } from './services/api';
import { useRouter } from 'next/navigation';
import { useAuth } from './context/auth-context';
import ProtectedRoute from './components/protected-route';
import Navbar from './components/navbar';

export default function Home() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'text' | 'link' | 'image'>('text');
  const [linkInput, setLinkInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const router = useRouter();

  // Reusable Spinner Component
  const Spinner = () => (
    <div style={{
      width: '16px',
      height: '16px',
      border: '2px solid transparent',
      borderTop: '2px solid white',
      borderRadius: '50%',
      animation: 'spin 0.5s linear infinite',
    }} />
  );

  // Reusable Submit Button Component
  const SubmitButton = ({ 
    onClick, 
    disabled, 
    children 
  }: { 
    onClick: () => void;
    disabled: boolean;
    children: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '8px 16px',
        background: disabled ? '#ccc' : '#37352f',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      {isSubmitting && <Spinner />}
      {isSubmitting ? 'Adding...' : children}
    </button>
  );

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        // Only fetch recipes if we've confirmed authentication state
        if (!authLoading) {
          setLoading(true);
          const fetchedRecipes = await ApiService.getAllRecipes();
          setRecipes(fetchedRecipes);
          setError(null);
        }
      } catch (err) {
        console.error('Failed to fetch recipes:', err);
        // Check if the error is authentication related
        if (err instanceof Error && err.message === 'Authentication required') {
          // Don't show error for auth issues - just let the redirect happen
          // Auth error handled by ApiService redirecting to login
          setError(null);
        } else {
          setError('Failed to load recipes. Please try again later.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchRecipes();
  }, [authLoading]);

  const handleAddFromLink = async () => {
    if (!linkInput.trim()) return;
    
    try {
      setIsSubmitting(true);
      const newRecipe = await ApiService.addDishFromLink(linkInput.trim());
      closeModal();
      router.push(`/recipe/${newRecipe.dish_id}`);
    } catch (err) {
      console.error('Failed to add recipe from link:', err);
      alert('Failed to add recipe from link. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddFromText = async () => {
    if (!textInput.trim()) return;
    
    try {
      setIsSubmitting(true);
      const newRecipe = await ApiService.addDishFromText(textInput.trim());
      closeModal();
      router.push(`/recipe/${newRecipe.dish_id}`);
    } catch (err) {
      console.error('Failed to add recipe from text:', err);
      alert('Failed to add recipe from text. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddFromImage = async () => {
    if (!selectedImage) return;
    
    try {
      setIsSubmitting(true);
      const newRecipe = await ApiService.addDishFromImage(selectedImage);
      closeModal();
      router.push(`/recipe/${newRecipe.dish_id}`);
    } catch (err) {
      console.error('Failed to add recipe from image:', err);
      alert('Failed to add recipe from image. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setLinkInput('');
    setTextInput('');
    setSelectedImage(null);
    setImagePreview(null);
  };

  const Modal = () => {
    if (!showModal) return null;

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          width: '90%',
          maxWidth: '500px',
          maxHeight: '80vh',
          overflow: 'hidden',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
        }}>
          {/* Modal Header */}
          <div style={{
            padding: '20px',
            borderBottom: '1px solid #e9e9e7',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Add New Recipe</h3>
            <button
              onClick={closeModal}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#666',
                padding: '0',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ×
            </button>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid #e9e9e7',
          }}>
            {(['text', 'link', 'image'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  border: 'none',
                  background: activeTab === tab ? '#f7f6f3' : 'transparent',
                  color: activeTab === tab ? '#37352f' : '#666',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: activeTab === tab ? '500' : '400',
                  textTransform: 'capitalize',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{ 
            padding: '20px',
            height: '280px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {activeTab === 'text' && (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                height: '100%' 
              }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#37352f',
                }}>
                  Recipe Text
                </label>
                <div style={{ 
                  height: '180px', // Fixed height container
                  marginBottom: '16px',
                }}>
                  <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Paste your recipe text here..."
                    style={{
                      width: '100%',
                      height: '100%', // Fill the container
                      padding: '12px',
                      border: '1px solid #e9e9e7',
                      borderRadius: '4px',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                      resize: 'none',
                      fontFamily: 'inherit',
                    }}
                    disabled={isSubmitting}
                  />
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: 'auto' }}>
                  <button
                    onClick={closeModal}
                    style={{
                      padding: '8px 16px',
                      border: '1px solid #e9e9e7',
                      background: 'white',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px',
                    }}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <SubmitButton
                    onClick={handleAddFromText}
                    disabled={!textInput.trim() || isSubmitting}
                  >
                    Add Recipe
                  </SubmitButton>
                </div>
              </div>
            )}

            {activeTab === 'link' && (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                height: '100%' 
              }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#37352f',
                }}>
                  Recipe URL
                </label>
                <div style={{ 
                  height: '180px', // Fixed height container - same as text tab
                  marginBottom: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  <input
                    type="url"
                    value={linkInput}
                    onChange={(e) => setLinkInput(e.target.value)}
                    placeholder="https://example.com/recipe"
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e9e9e7',
                      borderRadius: '4px',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                    disabled={isSubmitting}
                  />
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: 'auto' }}>
                  <button
                    onClick={closeModal}
                    style={{
                      padding: '8px 16px',
                      border: '1px solid #e9e9e7',
                      background: 'white',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px',
                    }}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <SubmitButton
                    onClick={handleAddFromLink}
                    disabled={!linkInput.trim() || isSubmitting}
                  >
                    Add Recipe
                  </SubmitButton>
                </div>
              </div>
            )}

            {activeTab === 'image' && (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                height: '100%'
              }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#37352f',
                }}>
                  Recipe Image
                </label>
                
                <div style={{ 
                  height: '180px', // Fixed height container - same as other tabs
                  marginBottom: '16px',
                }}>
                  {/* File Upload Area */}
                  <div style={{
                    border: '2px dashed #e9e9e7',
                    borderRadius: '8px',
                    padding: '20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    backgroundColor: selectedImage ? '#f7f6f3' : 'transparent',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%', // Fill the container
                    boxSizing: 'border-box',
                    overflow: 'hidden', // Prevent content from overflowing
                  }}
                  onClick={() => document.getElementById('image-upload')?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = '#37352f';
                    e.currentTarget.style.backgroundColor = '#f7f6f3';
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = '#e9e9e7';
                    e.currentTarget.style.backgroundColor = selectedImage ? '#f7f6f3' : 'transparent';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = '#e9e9e7';
                    e.currentTarget.style.backgroundColor = selectedImage ? '#f7f6f3' : 'transparent';
                    
                    const files = Array.from(e.dataTransfer.files);
                    const imageFile = files.find(file => file.type.startsWith('image/'));
                    if (imageFile) {
                      setSelectedImage(imageFile);
                      const previewUrl = URL.createObjectURL(imageFile);
                      setImagePreview(previewUrl);
                    }
                  }}
                  >
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      style={{ display: 'none' }}
                      disabled={isSubmitting}
                    />
                    
                    {imagePreview ? (
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                        height: '100%',
                        justifyContent: 'center',
                        maxHeight: '100%',
                        overflow: 'hidden'
                      }}>
                        <img
                          src={imagePreview}
                          alt="Recipe preview"
                          style={{
                            maxWidth: '100px',
                            maxHeight: '70px',
                            borderRadius: '4px',
                            objectFit: 'cover',
                            flexShrink: 0
                          }}
                        />
                        <div style={{
                          fontSize: '12px',
                          color: '#666',
                          fontWeight: '500',
                          textAlign: 'center',
                          wordBreak: 'break-word',
                          maxWidth: '180px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {selectedImage?.name}
                        </div>
                        <div style={{
                          fontSize: '10px',
                          color: '#999',
                        }}>
                          Click to change image
                        </div>
                      </div>
                    ) : (
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
                          Upload Recipe Image
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: '#999',
                        }}>
                          Click or drag image here
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: 'auto' }}>
                  <button
                    onClick={closeModal}
                    style={{
                      padding: '8px 16px',
                      border: '1px solid #e9e9e7',
                      background: 'white',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px',
                    }}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <SubmitButton
                    onClick={handleAddFromImage}
                    disabled={!selectedImage || isSubmitting}
                  >
                    Add Recipe
                  </SubmitButton>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <Navbar />

        <div style={{ 
          padding: '40px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100vh - 60px)'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: '18px', 
              color: '#787774',
              marginBottom: '16px'
            }}>
              Loading recipes...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <Navbar />

        <div style={{ 
          padding: '40px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100vh - 60px)'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: '18px', 
              color: '#e74c3c',
              marginBottom: '16px'
            }}>
              {error}
            </div>
            <button 
              onClick={() => window.location.reload()}
              style={{
                padding: '8px 16px',
                background: '#37352f',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <div style={{ marginBottom: '48px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
              <h1 style={{ 
                fontSize: '32px', 
                fontWeight: '600', 
                color: '#37352f',
                margin: '0'
              }}>
                Recipes
              </h1>
              <button
                onClick={() => setShowModal(true)}
                style={{
                  padding: '8px 16px',
                  background: '#37352f',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span style={{ fontSize: '18px' }}>+</span>
                Add
              </button>
            </div>
            <p style={{ 
              fontSize: '16px', 
              color: '#787774',
              margin: '0'
            }}>
              A collection of recipes
            </p>
          </div>

          <div style={{ 
            display: 'flex',
            flexDirection: 'column',
            gap: '1px'
          }}>
            {recipes.map((recipe) => (
              <Link
                key={recipe.dish_id}
                href={`/recipe/${recipe.dish_id}`}
                style={{ 
                  textDecoration: 'none', 
                  color: 'inherit',
                  display: 'block'
                }}
              >
                <div style={{
                  padding: '12px 16px',
                  background: '#ffffff',
                  border: '1px solid #e9e9e7',
                  borderRadius: '3px',
                  transition: 'background-color 0.1s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f7f6f3';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    {recipe.emoji && (
                      <span style={{ fontSize: '20px' }}>
                        {recipe.emoji}
                      </span>
                    )}
                    <span style={{ 
                      fontSize: '16px', 
                      fontWeight: '500', 
                      color: '#37352f',
                      lineHeight: '1.4'
                    }}>
                      {recipe.title}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <Modal />
    </div>
    </ProtectedRoute>
  );
}
