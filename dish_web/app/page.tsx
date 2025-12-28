'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { ApiService, RecipeMetadata } from './services/api';
import { useAuth } from './context/auth-context';
import ProtectedRoute from './components/protected-route';
import Navbar from './components/navbar';
import { processImageOrientation } from './utils/imageUtils';

// Modal Component
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
}) => {
  if (!showModal) return null;

  const tabs = ['text', 'link', 'image'] as const;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '8px',
        width: '100%',
        maxWidth: '500px',
        border: '1px solid #e5e5e5',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e5e5e5',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '18px', fontWeight: '600', color: '#1a1a1a' }}>Add Recipe</span>
          <button
            onClick={closeModal}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              color: '#999',
              padding: '4px 8px',
            }}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e5e5e5',
        }}>
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '12px 16px',
                border: 'none',
                background: 'transparent',
                color: activeTab === tab ? '#1a1a1a' : '#999',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: activeTab === tab ? '500' : '400',
                textTransform: 'capitalize',
                borderBottom: activeTab === tab ? '2px solid #1a1a1a' : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '16px 20px 20px' }}>
          {activeTab === 'text' && (
            <div>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Paste your recipe text here..."
                style={{
                  width: '100%',
                  height: '150px',
                  padding: '12px',
                  border: '1px solid #e5e5e5',
                  borderRadius: '6px',
                  fontSize: '14px',
                  resize: 'none',
                  fontFamily: 'inherit',
                  outline: 'none',
                  color: '#1a1a1a',
                }}
                disabled={isSubmitting}
              />
            </div>
          )}

          {activeTab === 'link' && (
            <div>
              <input
                type="url"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                placeholder="https://example.com/recipe"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e5e5e5',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none',
                  color: '#1a1a1a',
                }}
                disabled={isSubmitting}
              />
            </div>
          )}

          {activeTab === 'image' && (
            <div>
              <div
                style={{
                  border: '2px dashed #e5e5e5',
                  borderRadius: '8px',
                  padding: '32px 24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
                onClick={() => document.getElementById('image-upload')?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={async (e) => {
                  e.preventDefault();
                  const files = Array.from(e.dataTransfer.files);
                  const imageFile = files.find(file => file.type.startsWith('image/'));
                  if (imageFile) {
                    try {
                      const processedFile = await processImageOrientation(imageFile);
                      setSelectedImage(processedFile);
                      setImagePreview(URL.createObjectURL(processedFile));
                    } catch {
                      setSelectedImage(imageFile);
                      setImagePreview(URL.createObjectURL(imageFile));
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
                  <div>
                    <img
                      src={imagePreview}
                      alt="Preview"
                      style={{
                        maxWidth: '100px',
                        maxHeight: '80px',
                        borderRadius: '4px',
                        marginBottom: '8px',
                      }}
                    />
                    <div style={{ fontSize: '13px', color: '#666' }}>
                      {selectedImage?.name}
                    </div>
                  </div>
                ) : (
                  <div style={{ color: '#999', fontSize: '14px' }}>
                    Drop image or click to upload
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
            marginTop: '20px',
          }}>
            <button
              onClick={closeModal}
              disabled={isSubmitting}
              style={{
                padding: '8px 16px',
                border: '1px solid #e5e5e5',
                background: '#fff',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                color: '#6b6b6b',
              }}
            >
              Cancel
            </button>
            <button
              onClick={
                activeTab === 'text' ? handleAddFromText :
                activeTab === 'link' ? handleAddFromLink :
                handleAddFromImage
              }
              disabled={
                isSubmitting ||
                (activeTab === 'text' && !textInput.trim()) ||
                (activeTab === 'link' && !linkInput.trim()) ||
                (activeTab === 'image' && !selectedImage)
              }
              style={{
                padding: '8px 16px',
                border: 'none',
                background: '#1a1a1a',
                color: '#fff',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                opacity: (
                  isSubmitting ||
                  (activeTab === 'text' && !textInput.trim()) ||
                  (activeTab === 'link' && !linkInput.trim()) ||
                  (activeTab === 'image' && !selectedImage)
                ) ? 0.4 : 1,
              }}
            >
              {isSubmitting ? 'Adding...' : 'Add Recipe'}
            </button>
          </div>
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

  const sortedRecipes = useMemo(() => {
    return [...recipes].sort((a, b) => {
      if (!a.date_added && !b.date_added) return 0;
      if (!a.date_added) return 1;
      if (!b.date_added) return -1;
      return new Date(b.date_added).getTime() - new Date(a.date_added).getTime();
    });
  }, [recipes]);

  const fetchRecipes = useCallback(async () => {
    try {
      if (!authLoading) {
        setLoading(true);
        const fetchedRecipes = await ApiService.getAllRecipes();
        setRecipes(fetchedRecipes);
        setError(null);
      }
    } catch (err) {
      console.error('Failed to fetch recipes:', err);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [authLoading]);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  // Poll processing dishes
  useEffect(() => {
    const processingDishes = recipes.filter(r => r.status === 'processing');
    if (processingDishes.length === 0) return;

    const pollInterval = setInterval(async () => {
      try {
        const updates = await Promise.all(
          processingDishes.map(async (dish) => {
            try {
              const updatedDish = await ApiService.getRecipeById(dish.dish_id);
              if (updatedDish && updatedDish.status !== 'processing') {
                return {
                  dish_id: updatedDish.dish_id,
                  title: updatedDish.title,
                  description: updatedDish.description,
                  emoji: updatedDish.emoji,
                  date_added: dish.date_added,
                  status: updatedDish.status,
                } as RecipeMetadata;
              }
            } catch (err) {
              console.error(`Failed to poll dish ${dish.dish_id}:`, err);
            }
            return null;
          })
        );

        const completedUpdates = updates.filter((u): u is RecipeMetadata => u !== null);
        if (completedUpdates.length > 0) {
          setRecipes(prev => prev.map(recipe => {
            const update = completedUpdates.find(u => u.dish_id === recipe.dish_id);
            return update || recipe;
          }));
        }
      } catch (err) {
        console.error('Error polling processing dishes:', err);
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [recipes]);

  const handleAddFromLink = useCallback(async () => {
    if (!linkInput.trim()) return;
    try {
      setIsSubmitting(true);
      await ApiService.addDishFromLink(linkInput.trim());
      closeModal();
      await fetchRecipes();
    } catch (err) {
      console.error('Failed to add recipe from link:', err);
      alert('Failed to add recipe. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [linkInput, fetchRecipes]);

  const handleAddFromText = useCallback(async () => {
    if (!textInput.trim()) return;
    try {
      setIsSubmitting(true);
      await ApiService.addDishFromText(textInput.trim());
      closeModal();
      await fetchRecipes();
    } catch (err) {
      console.error('Failed to add recipe from text:', err);
      alert('Failed to add recipe. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [textInput, fetchRecipes]);

  const handleAddFromImage = useCallback(async () => {
    if (!selectedImage) return;
    try {
      setIsSubmitting(true);
      const processedImage = await processImageOrientation(selectedImage);
      await ApiService.addDishFromImage(processedImage);
      closeModal();
      await fetchRecipes();
    } catch (err) {
      console.error('Failed to add recipe from image:', err);
      alert('Failed to add recipe. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedImage, fetchRecipes]);

  const handleImageSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const processedFile = await processImageOrientation(file);
        setSelectedImage(processedFile);
        setImagePreview(URL.createObjectURL(processedFile));
      } catch {
        setSelectedImage(file);
        setImagePreview(URL.createObjectURL(file));
      }
    }
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setLinkInput('');
    setTextInput('');
    setSelectedImage(null);
    setImagePreview(null);
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#fff' }}>
        <Navbar />
        <div style={{
          maxWidth: '600px',
          margin: '0 auto',
          padding: '60px 20px',
          textAlign: 'center',
          color: '#999',
          fontSize: '14px',
        }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div style={{ minHeight: '100vh', background: '#fff' }}>
        <Navbar />

        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '32px',
          }}>
            <h1 style={{
              fontSize: '32px',
              fontWeight: '600',
              color: '#1a1a1a',
              margin: 0,
            }}>
              Recipes
            </h1>
            <button
              onClick={() => setShowModal(true)}
              style={{
                padding: '8px 16px',
                background: '#1a1a1a',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              + Add
            </button>
          </div>

          {/* Recipe List */}
          <div style={{
            background: '#fff',
            border: '1px solid #e5e5e5',
            borderRadius: '8px',
            overflow: 'hidden',
          }}>
            {sortedRecipes.length === 0 ? (
              <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: '#999',
                fontSize: '14px',
              }}>
                No recipes yet
              </div>
            ) : (
              sortedRecipes.map((recipe, index) => {
                const isProcessing = recipe.status === 'processing';
                const isLast = index === sortedRecipes.length - 1;

                const content = (
                  <div
                    className={isProcessing ? 'processing-dish' : ''}
                    style={{
                      padding: '14px 16px',
                      borderBottom: isLast ? 'none' : '1px solid #e5e5e5',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: isProcessing ? 'default' : 'pointer',
                    }}
                  >
                    {recipe.emoji && (
                      <span style={{ fontSize: '20px' }}>{recipe.emoji}</span>
                    )}
                    <span style={{
                      fontSize: '16px',
                      color: isProcessing ? '#999' : '#1a1a1a',
                    }}>
                      {recipe.title}
                    </span>
                  </div>
                );

                if (isProcessing) {
                  return <div key={recipe.dish_id}>{content}</div>;
                }

                return (
                  <Link
                    key={recipe.dish_id}
                    href={`/recipe/${recipe.dish_id}`}
                    style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                  >
                    {content}
                  </Link>
                );
              })
            )}
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
        />
      </div>
    </ProtectedRoute>
  );
}
