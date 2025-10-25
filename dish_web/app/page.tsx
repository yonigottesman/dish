'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { ApiService, Recipe, RecipeMetadata } from './services/api';
import { useRouter } from 'next/navigation';
import { useAuth } from './context/auth-context';
import ProtectedRoute from './components/protected-route';
import Navbar from './components/navbar';
import { processImageOrientation } from './utils/imageUtils';
import { useProgressBar } from './hooks/useTabProgressBar';
import { ProgressBar } from './components/ProgressBar';

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
  children,
  isSubmitting 
}: { 
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
  isSubmitting: boolean;
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

// Modal Component - memoized to prevent unnecessary re-renders
const Modal = memo(({ 
  showModal, 
  closeModal, 
  activeTab, 
  setActiveTab, 
  linkInput, 
  setLinkInput, 
  textInput, 
  setTextInput, 
  selectedImage, 
  setSelectedImage, 
  imagePreview, 
  setImagePreview, 
  isSubmitting, 
  handleAddFromLink, 
  handleAddFromText, 
  handleAddFromImage,
  handleImageSelect,
  uploadProgress,
  isUploading,
  linkProgress,
  linkIsUploading,
  textProgress,
  textIsUploading
}: {
  showModal: boolean;
  closeModal: () => void;
  activeTab: 'text' | 'link' | 'image';
  setActiveTab: (tab: 'text' | 'link' | 'image') => void;
  linkInput: string;
  setLinkInput: (value: string) => void;
  textInput: string;
  setTextInput: (value: string) => void;
  selectedImage: File | null;
  setSelectedImage: (file: File | null) => void;
  imagePreview: string | null;
  setImagePreview: (url: string | null) => void;
  isSubmitting: boolean;
  handleAddFromLink: () => void;
  handleAddFromText: () => void;
  handleAddFromImage: () => void;
  handleImageSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  uploadProgress: number;
  isUploading: boolean;
  linkProgress: number;
  linkIsUploading: boolean;
  textProgress: number;
  textIsUploading: boolean;
}) => {
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
      padding: '16px',
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        width: '100%',
        maxWidth: '500px',
        maxHeight: '90vh',
        overflow: 'hidden',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e9e9e7',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
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
          flexShrink: 0,
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
          padding: '16px 20px 20px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}>
          {activeTab === 'text' && (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              height: '100%',
              minHeight: '220px',
            }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#37352f',
                flexShrink: 0,
              }}>
                Recipe Text
              </label>
              <div style={{ 
                flex: 1,
                marginBottom: '16px',
                minHeight: '100px',
              }}>
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Paste your recipe text here..."
                  style={{
                    width: '100%',
                    height: '100%',
                    padding: '12px',
                    border: '1px solid #e9e9e7',
                    borderRadius: '4px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    resize: 'none',
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                  disabled={isSubmitting}
                />
              </div>
              
              {/* Progress Bar for Text */}
              <ProgressBar progress={textProgress} isActive={textIsUploading} />

              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                justifyContent: 'flex-end',
                flexShrink: 0,
                paddingTop: '8px',
              }}>
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
                  isSubmitting={isSubmitting}
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
              height: '100%',
              minHeight: '220px',
            }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#37352f',
                flexShrink: 0,
              }}>
                Recipe URL
              </label>
              <div style={{ 
                flex: 1,
                marginBottom: '16px',
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100px',
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
                    outline: 'none',
                  }}
                  disabled={isSubmitting}
                />
              </div>
              
              {/* Progress Bar for Link */}
              <ProgressBar progress={linkProgress} isActive={linkIsUploading} />

              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                justifyContent: 'flex-end',
                flexShrink: 0,
                paddingTop: '8px',
              }}>
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
                  isSubmitting={isSubmitting}
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
              height: '100%',
              minHeight: '220px',
            }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#37352f',
                flexShrink: 0,
              }}>
                Recipe Image
              </label>
              
              <div style={{ 
                flex: 1,
                marginBottom: '16px',
                minHeight: '100px',
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
                  height: '100%',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
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
                onDrop={async (e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = '#e9e9e7';
                  e.currentTarget.style.backgroundColor = selectedImage ? '#f7f6f3' : 'transparent';
                  
                  const files = Array.from(e.dataTransfer.files);
                  const imageFile = files.find(file => file.type.startsWith('image/'));
                  if (imageFile) {
                    try {
                      console.log('Processing dropped image...');
                      // Process the image orientation
                      const processedFile = await processImageOrientation(imageFile);
                      setSelectedImage(processedFile);
                      const previewUrl = URL.createObjectURL(processedFile);
                      setImagePreview(previewUrl);
                    } catch (error) {
                      console.error('Error processing dropped image:', error);
                      // Fallback to original file if processing fails
                      setSelectedImage(imageFile);
                      const previewUrl = URL.createObjectURL(imageFile);
                      setImagePreview(previewUrl);
                    }
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
                        marginTop: '4px'
                      }}>
                        Click to change
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

              {/* Progress Bar */}
              <ProgressBar progress={uploadProgress} isActive={isUploading} />

              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                justifyContent: 'flex-end',
                flexShrink: 0,
                paddingTop: '8px',
              }}>
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
                  isSubmitting={isSubmitting}
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
});

Modal.displayName = 'Modal';

export default function Home() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [recipes, setRecipes] = useState<RecipeMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'text' | 'link' | 'image'>('text');
  const [linkInput, setLinkInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingLink, setIsUploadingLink] = useState(false);
  const [isUploadingText, setIsUploadingText] = useState(false);
  const router = useRouter();

  // Progress bar hook for image uploads (20 seconds)
  const { 
    progress: imageProgress, 
    isActive: imageIsActive, 
    resetProgressBar: resetImageProgress 
  } = useProgressBar({
    duration: 16000, // 16 seconds
    active: isUploadingImage,
    onComplete: () => {
      console.log('Image progress bar completed');
    }
  });

  // Progress bar hook for link uploads (10 seconds)
  const { 
    progress: linkProgress, 
    isActive: linkIsActive, 
    resetProgressBar: resetLinkProgress 
  } = useProgressBar({
    duration: 10000, // 10 seconds
    active: isUploadingLink,
    onComplete: () => {
      console.log('Link progress bar completed');
    }
  });

  // Progress bar hook for text uploads (10 seconds)
  const { 
    progress: textProgress, 
    isActive: textIsActive, 
    resetProgressBar: resetTextProgress 
  } = useProgressBar({
    duration: 10000, // 10 seconds
    active: isUploadingText,
    onComplete: () => {
      console.log('Text progress bar completed');
    }
  });

  // Sort recipes by date_added (newest first), handling null dates
  const sortedRecipes = useMemo(() => {
    return [...recipes].sort((a, b) => {
      // Handle null dates - put them at the end
      if (!a.date_added && !b.date_added) return 0;
      if (!a.date_added) return 1;
      if (!b.date_added) return -1;
      
      // Sort by date (newest first)
      return new Date(b.date_added).getTime() - new Date(a.date_added).getTime();
    });
  }, [recipes]);

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
          // setError('Failed to load recipes. Please try again later.');
          setError(null);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchRecipes();
  }, [authLoading]);

  const handleAddFromLink = useCallback(async () => {
    if (!linkInput.trim()) return;
    
    try {
      setIsSubmitting(true);
      setIsUploadingLink(true); // Start the link progress bar
      const newRecipe = await ApiService.addDishFromLink(linkInput.trim());
      closeModal();
      router.push(`/recipe/${newRecipe.dish_id}`);
    } catch (err) {
      console.error('Failed to add recipe from link:', err);
      alert('Failed to add recipe from link. Please try again.');
    } finally {
      setIsSubmitting(false);
      setIsUploadingLink(false); // Stop the link progress bar
    }
  }, [linkInput, router]);

  const handleAddFromText = useCallback(async () => {
    if (!textInput.trim()) return;
    
    try {
      setIsSubmitting(true);
      setIsUploadingText(true); // Start the text progress bar
      const newRecipe = await ApiService.addDishFromText(textInput.trim());
      closeModal();
      router.push(`/recipe/${newRecipe.dish_id}`);
    } catch (err) {
      console.error('Failed to add recipe from text:', err);
      alert('Failed to add recipe from text. Please try again.');
    } finally {
      setIsSubmitting(false);
      setIsUploadingText(false); // Stop the text progress bar
    }
  }, [textInput, router]);

  const handleAddFromImage = useCallback(async () => {
    if (!selectedImage) return;
    
    try {
      setIsSubmitting(true);
      setIsUploadingImage(true); // Start the progress bar
      console.log('Processing image before upload...');
      // Process the image orientation before uploading
      const processedImage = await processImageOrientation(selectedImage);
      const newRecipe = await ApiService.addDishFromImage(processedImage);
      closeModal();
      router.push(`/recipe/${newRecipe.dish_id}`);
    } catch (err) {
      console.error('Failed to add recipe from image:', err);
      alert('Failed to add recipe from image. Please try again.');
    } finally {
      setIsSubmitting(false);
      setIsUploadingImage(false); // Stop the progress bar
    }
  }, [selectedImage, router]);

  const handleImageSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        console.log('Processing selected image...');
        // Process the image orientation for preview
        const processedFile = await processImageOrientation(file);
        setSelectedImage(processedFile);
        // Create preview URL from processed file
        const previewUrl = URL.createObjectURL(processedFile);
        setImagePreview(previewUrl);
      } catch (error) {
        console.error('Error processing image:', error);
        // Fallback to original file if processing fails
        setSelectedImage(file);
        const previewUrl = URL.createObjectURL(file);
        setImagePreview(previewUrl);
      }
    }
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setLinkInput('');
    setTextInput('');
    setSelectedImage(null);
    setImagePreview(null);
    setIsUploadingImage(false); // Clear image progress bar state
    setIsUploadingLink(false); // Clear link progress bar state
    setIsUploadingText(false); // Clear text progress bar state
    // Reset all progress bars to ensure they start fresh next time
    resetImageProgress();
    resetLinkProgress();
    resetTextProgress();
  }, [resetImageProgress, resetLinkProgress, resetTextProgress]);

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
           
          </div>

          <div style={{ 
            display: 'flex',
            flexDirection: 'column',
            gap: '1px'
          }}>
            {sortedRecipes.map((recipe) => (
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

      <Modal
        showModal={showModal}
        closeModal={closeModal}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        linkInput={linkInput}
        setLinkInput={setLinkInput}
        textInput={textInput}
        setTextInput={setTextInput}
        selectedImage={selectedImage}
        setSelectedImage={setSelectedImage}
        imagePreview={imagePreview}
        setImagePreview={setImagePreview}
        isSubmitting={isSubmitting}
        handleAddFromLink={handleAddFromLink}
        handleAddFromText={handleAddFromText}
        handleAddFromImage={handleAddFromImage}
        handleImageSelect={handleImageSelect}
        uploadProgress={imageProgress}
        isUploading={imageIsActive}
        linkProgress={linkProgress}
        linkIsUploading={linkIsActive}
        textProgress={textProgress}
        textIsUploading={textIsActive}
      />
    </div>
    </ProtectedRoute>
  );
}
