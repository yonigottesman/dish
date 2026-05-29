'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { ApiService, RecipeMetadata } from './services/api';
import ProtectedRoute from './components/protected-route';
import Navbar from './components/navbar';

function relativeDate(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

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

  const tabs = [
    { key: 'text', label: 'Paste text' },
    { key: 'link', label: 'From link' },
    { key: 'image', label: 'From photo' },
  ] as const;

  const canSubmit =
    !isSubmitting &&
    ((activeTab === 'text' && textInput.trim()) ||
      (activeTab === 'link' && linkInput.trim()) ||
      (activeTab === 'image' && selectedImage));

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: '18px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '17px', fontWeight: 650, letterSpacing: '-0.01em' }}>Add a recipe</span>
          <button
            onClick={closeModal}
            aria-label="Close"
            style={{
              background: 'none', border: 'none', fontSize: '22px', lineHeight: 1,
              cursor: 'pointer', color: 'var(--ink-muted)', padding: '2px 6px',
            }}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`tab ${activeTab === tab.key ? 'tab-active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '20px' }}>
          {activeTab === 'text' && (
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Paste a recipe here — ingredients, steps, anything. We'll tidy it up."
              className="textarea"
              style={{ height: '160px' }}
              disabled={isSubmitting}
              autoFocus
            />
          )}

          {activeTab === 'link' && (
            <div>
              <input
                type="url"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                placeholder="https://example.com/recipe"
                className="input"
                disabled={isSubmitting}
                autoFocus
              />
              <p className="muted" style={{ fontSize: '13px', margin: '10px 2px 0' }}>
                Paste any recipe URL and we&apos;ll extract it for you.
              </p>
            </div>
          )}

          {activeTab === 'image' && (
            <div
              className="dropzone"
              onClick={() => document.getElementById('image-upload')?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const imageFile = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'));
                if (imageFile) {
                  setSelectedImage(imageFile);
                  setImagePreview(URL.createObjectURL(imageFile));
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
                    style={{ maxWidth: '120px', maxHeight: '90px', borderRadius: '8px', marginBottom: '10px' }}
                  />
                  <div style={{ fontSize: '13px', color: 'var(--ink-secondary)' }}>{selectedImage?.name}</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>📷</div>
                  Drop a photo here, or click to browse
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button onClick={closeModal} disabled={isSubmitting} className="btn btn-ghost">
              Cancel
            </button>
            <button
              onClick={
                activeTab === 'text' ? handleAddFromText :
                activeTab === 'link' ? handleAddFromLink :
                handleAddFromImage
              }
              disabled={!canSubmit}
              className="btn btn-accent"
            >
              {isSubmitting ? <><span className="spinner" /> Adding…</> : 'Add recipe'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

Modal.displayName = 'Modal';

function RecipeRowSkeleton() {
  return (
    <div className="row" style={{ cursor: 'default' }}>
      <div className="skeleton" style={{ width: '38px', height: '38px', borderRadius: '10px' }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton" style={{ height: '13px', width: '52%', marginBottom: '8px' }} />
        <div className="skeleton" style={{ height: '10px', width: '28%' }} />
      </div>
    </div>
  );
}

export default function Home() {
  const [recipes, setRecipes] = useState<RecipeMetadata[]>([]);
  const [loading, setLoading] = useState(true);
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
      setLoading(true);
      const fetchedRecipes = await ApiService.getAllRecipes();
      setRecipes(fetchedRecipes);
    } catch (err) {
      console.error('Failed to fetch recipes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const closeModal = useCallback(() => {
    setShowModal(false);
    setLinkInput('');
    setTextInput('');
    setSelectedImage(null);
    setImagePreview(null);
  }, []);

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
  }, [linkInput, fetchRecipes, closeModal]);

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
  }, [textInput, fetchRecipes, closeModal]);

  const handleAddFromImage = useCallback(async () => {
    if (!selectedImage) return;
    try {
      setIsSubmitting(true);
      await ApiService.addDishFromImage(selectedImage);
      closeModal();
      await fetchRecipes();
    } catch (err) {
      console.error('Failed to add recipe from image:', err);
      alert('Failed to add recipe. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedImage, fetchRecipes, closeModal]);

  const handleImageSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  }, []);

  return (
    <ProtectedRoute>
      <div style={{ minHeight: '100vh' }}>
        <Navbar />

        <div className="container" style={{ padding: '40px 20px 80px' }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: '24px',
            gap: '16px',
          }}>
            <div>
              <h1 className="page-title">Recipes</h1>
              {!loading && recipes.length > 0 && (
                <p className="muted" style={{ margin: '4px 0 0', fontSize: '14px' }}>
                  {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'} saved
                </p>
              )}
            </div>
            <button onClick={() => setShowModal(true)} className="btn btn-accent">
              <span style={{ fontSize: '16px', lineHeight: 1, marginTop: '-1px' }}>+</span> Add recipe
            </button>
          </div>

          {/* Recipe List */}
          {loading ? (
            <div className="card" style={{ overflow: 'hidden' }}>
              {Array.from({ length: 6 }).map((_, i) => <RecipeRowSkeleton key={i} />)}
            </div>
          ) : sortedRecipes.length === 0 ? (
            <div className="card fade-up" style={{ padding: '56px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🍳</div>
              <h2 style={{ fontSize: '17px', fontWeight: 600, margin: '0 0 6px' }}>No recipes yet</h2>
              <p className="muted" style={{ fontSize: '14px', margin: '0 0 20px' }}>
                Add one from a link, a photo, or by pasting text.
              </p>
              <button onClick={() => setShowModal(true)} className="btn btn-accent">
                <span style={{ fontSize: '16px', lineHeight: 1, marginTop: '-1px' }}>+</span> Add your first recipe
              </button>
            </div>
          ) : (
            <div className="card fade-up" style={{ overflow: 'hidden' }}>
              {sortedRecipes.map((recipe) => {
                const isProcessing = recipe.status === 'processing';
                const date = relativeDate(recipe.date_added);

                const content = (
                  <div className={`row ${isProcessing ? 'processing-dish' : ''}`} style={{ cursor: isProcessing ? 'default' : 'pointer' }}>
                    <div className="row-emoji">{recipe.emoji || '🍽️'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '15.5px',
                        fontWeight: 500,
                        color: isProcessing ? 'var(--ink-muted)' : 'var(--ink)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {recipe.title}
                      </div>
                      {isProcessing ? (
                        <div className="muted" style={{ fontSize: '12.5px', marginTop: '2px' }}>Processing…</div>
                      ) : date ? (
                        <div className="muted" style={{ fontSize: '12.5px', marginTop: '2px' }}>{date}</div>
                      ) : null}
                    </div>
                    {!isProcessing && (
                      <span className="row-chevron" aria-hidden>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </span>
                    )}
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
              })}
            </div>
          )}
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
