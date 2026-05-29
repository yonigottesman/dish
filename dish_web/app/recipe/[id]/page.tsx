'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { ApiService, Recipe } from '../../services/api';
import ProtectedRoute from '../../components/protected-route';
import Navbar from '../../components/navbar';

function RecipeImages({ imageIds, isEditing, onDeleteImage }: {
  imageIds: string[];
  isEditing?: boolean;
  onDeleteImage?: (imageId: string) => void;
}) {
  if (!imageIds || imageIds.length === 0) return null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      marginBottom: '36px',
      maxWidth: '440px',
    }}>
      {imageIds.map((imageId, index) => (
        <div
          key={imageId}
          style={{
            position: 'relative',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <a
            href={ApiService.getImageUrl(imageId)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'block' }}
          >
            <img
              src={ApiService.getImageUrl(imageId)}
              alt={`Recipe image ${index + 1}`}
              style={{ display: 'block', maxWidth: '100%', height: 'auto', cursor: 'pointer' }}
            />
          </a>
          {isEditing && onDeleteImage && (
            <button
              onClick={() => onDeleteImage(imageId)}
              aria-label="Remove image"
              style={{
                position: 'absolute', top: '10px', right: '10px',
                width: '28px', height: '28px', borderRadius: '999px',
                background: 'rgba(27,26,24,0.7)', color: '#fff', border: 'none',
                cursor: 'pointer', fontSize: '15px', backdropFilter: 'blur(4px)',
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
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [editedRecipe, setEditedRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [checkedInstructions, setCheckedInstructions] = useState<Set<number>>(new Set());
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);

  const toggleIngredient = (index: number) => {
    const newChecked = new Set(checkedIngredients);
    if (newChecked.has(index)) newChecked.delete(index);
    else newChecked.add(index);
    setCheckedIngredients(newChecked);
  };

  const toggleInstruction = (index: number) => {
    const newChecked = new Set(checkedInstructions);
    if (newChecked.has(index)) newChecked.delete(index);
    else newChecked.add(index);
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
      setNewImages([]);
      setNewImagePreviews([]);
    } catch (err) {
      console.error('Failed to save recipe:', err);
      alert('Failed to save recipe. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!recipe) return;
    const isConfirmed = window.confirm(`Delete "${recipe.title}"? This cannot be undone.`);
    if (!isConfirmed) return;
    try {
      setIsDeleting(true);
      await ApiService.deleteRecipe(recipeId);
      window.location.href = '/';
    } catch (err) {
      console.error('Failed to delete recipe:', err);
      alert('Failed to delete recipe. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleShare = async () => {
    if (!recipe) return;
    try {
      setIsSharing(true);
      await ApiService.shareDish(recipeId);
      setShareLink(`${window.location.origin}/shared/${recipeId}`);
    } catch (err) {
      console.error('Failed to share recipe:', err);
      alert('Failed to create share link. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  const copyShareLink = () => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  };

  const updateEditedField = (field: keyof Recipe, value: any) => {
    if (editedRecipe) setEditedRecipe({ ...editedRecipe, [field]: value });
  };

  const addIngredient = () => {
    if (editedRecipe) setEditedRecipe({ ...editedRecipe, ingredients: [...editedRecipe.ingredients, ''] });
  };

  const removeIngredient = (index: number) => {
    if (editedRecipe) setEditedRecipe({ ...editedRecipe, ingredients: editedRecipe.ingredients.filter((_, i) => i !== index) });
  };

  const updateIngredient = (index: number, value: string) => {
    if (editedRecipe) {
      const newIngredients = [...editedRecipe.ingredients];
      newIngredients[index] = value;
      setEditedRecipe({ ...editedRecipe, ingredients: newIngredients });
    }
  };

  const addInstruction = () => {
    if (editedRecipe) setEditedRecipe({ ...editedRecipe, instructions: [...editedRecipe.instructions, ''] });
  };

  const removeInstruction = (index: number) => {
    if (editedRecipe) setEditedRecipe({ ...editedRecipe, instructions: editedRecipe.instructions.filter((_, i) => i !== index) });
  };

  const updateInstruction = (index: number, value: string) => {
    if (editedRecipe) {
      const newInstructions = [...editedRecipe.instructions];
      newInstructions[index] = value;
      setEditedRecipe({ ...editedRecipe, instructions: newInstructions });
    }
  };

  const removeImage = (imageId: string) => {
    if (editedRecipe && editedRecipe.image_ids) {
      setEditedRecipe({ ...editedRecipe, image_ids: editedRecipe.image_ids.filter(id => id !== imageId) });
    }
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      setNewImages(prev => [...prev, ...files]);
      const previews = files.map(file => URL.createObjectURL(file));
      setNewImagePreviews(prev => [...prev, ...previews]);
    }
  };

  const removeNewImage = (index: number) => {
    setNewImages(prev => prev.filter((_, i) => i !== index));
    setNewImagePreviews(prev => {
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
        setError('Failed to load recipe.');
      } finally {
        setLoading(false);
      }
    };
    if (recipeId) fetchRecipe();
  }, [recipeId]);

  const backLink = (
    <Link href="/" style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      color: 'var(--ink-secondary)', fontSize: '14px', textDecoration: 'none', marginBottom: '24px',
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      Recipes
    </Link>
  );

  if (loading) {
    return (
      <ProtectedRoute>
        <div style={{ minHeight: '100vh' }}>
          <Navbar />
          <div className="container" style={{ padding: '40px 20px' }}>
            <div className="skeleton" style={{ height: '36px', width: '60%', marginBottom: '14px' }} />
            <div className="skeleton" style={{ height: '16px', width: '85%', marginBottom: '8px' }} />
            <div className="skeleton" style={{ height: '16px', width: '70%', marginBottom: '40px' }} />
            <div className="skeleton" style={{ height: '200px', width: '100%' }} />
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !recipe) {
    return (
      <ProtectedRoute>
        <div style={{ minHeight: '100vh' }}>
          <Navbar />
          <div className="container" style={{ padding: '80px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🤷</div>
            <p className="secondary" style={{ fontSize: '15px', marginBottom: '20px' }}>{error || 'Recipe not found'}</p>
            <Link href="/" className="btn btn-ghost">Back to recipes</Link>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const displayRecipe = isEditing ? editedRecipe! : recipe;
  const isHebrew = displayRecipe.language === 'he';
  const dir = isHebrew ? 'rtl' : 'ltr';

  return (
    <ProtectedRoute>
      <div style={{ minHeight: '100vh' }}>
        <Navbar />

        <div className="container fade-up" style={{ padding: '32px 20px 80px' }}>
          {backLink}

          {/* Title */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '14px',
              flexDirection: isHebrew ? 'row-reverse' : 'row',
            }}>
              {isEditing ? (
                <>
                  <input
                    type="text"
                    value={displayRecipe.emoji || ''}
                    onChange={(e) => updateEditedField('emoji', e.target.value)}
                    placeholder="🍽️"
                    className="input"
                    style={{ width: '64px', textAlign: 'center', fontSize: '30px', padding: '8px', flexShrink: 0 }}
                  />
                  <input
                    type="text"
                    value={displayRecipe.title}
                    onChange={(e) => updateEditedField('title', e.target.value)}
                    className="input"
                    style={{ flex: 1, fontSize: '24px', fontWeight: 650, direction: dir }}
                  />
                </>
              ) : (
                <>
                  {displayRecipe.emoji && (
                    <span style={{
                      flexShrink: 0, width: '52px', height: '52px', display: 'grid', placeItems: 'center',
                      fontSize: '30px', background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: '14px', boxShadow: 'var(--shadow-sm)',
                    }}>{displayRecipe.emoji}</span>
                  )}
                  <h1 style={{
                    fontSize: '30px', fontWeight: 650, letterSpacing: '-0.02em', color: 'var(--ink)',
                    margin: 0, direction: dir, lineHeight: 1.2, paddingTop: '4px', flex: 1,
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
                className="textarea"
                style={{ minHeight: '80px', direction: dir }}
              />
            ) : displayRecipe.description ? (
              <p style={{ fontSize: '16px', color: 'var(--ink-secondary)', margin: 0, lineHeight: 1.65, direction: dir }}>
                {displayRecipe.description}
              </p>
            ) : null}

            {isEditing && (
              <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="secondary" style={{ fontSize: '13px' }}>Language</span>
                <select
                  value={displayRecipe.language || 'en'}
                  onChange={(e) => updateEditedField('language', e.target.value)}
                  className="input"
                  style={{ width: 'auto', padding: '7px 10px', fontSize: '14px' }}
                >
                  <option value="en">English</option>
                  <option value="he">Hebrew</option>
                </select>
              </div>
            )}

            {recipe.link && (
              <div style={{ marginTop: '14px' }}>
                {isEditing ? (
                  <input
                    type="url"
                    value={displayRecipe.link || ''}
                    onChange={(e) => updateEditedField('link', e.target.value)}
                    placeholder="https://..."
                    className="input"
                  />
                ) : (
                  <a href={recipe.link} target="_blank" rel="noopener noreferrer" className="badge" style={{ textDecoration: 'none' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    Source
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Images */}
          <RecipeImages imageIds={displayRecipe.image_ids || []} isEditing={isEditing} onDeleteImage={removeImage} />

          {/* New Images Upload */}
          {isEditing && (
            <div style={{ marginBottom: '32px' }}>
              <div
                className="dropzone"
                style={{ padding: '20px' }}
                onClick={() => document.getElementById('edit-image-upload')?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                  if (files.length > 0) {
                    setNewImages(prev => [...prev, ...files]);
                    setNewImagePreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
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
                />
                Drop images or click to upload
              </div>

              {newImagePreviews.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '12px' }}>
                  {newImagePreviews.map((preview, index) => (
                    <div key={index} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)', aspectRatio: '1' }}>
                      <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        onClick={() => removeNewImage(index)}
                        style={{
                          position: 'absolute', top: '4px', right: '4px', width: '22px', height: '22px',
                          borderRadius: '999px', background: 'rgba(27,26,24,0.7)', color: '#fff',
                          border: 'none', cursor: 'pointer', fontSize: '12px',
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

          {/* Ingredients */}
          <div style={{ marginBottom: '36px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 className="section-title">Ingredients</h2>
              {isEditing && (
                <button onClick={addIngredient} className="btn btn-ghost btn-sm">+ Add</button>
              )}
            </div>
            <div className="card" style={{ overflow: 'hidden' }}>
              {displayRecipe.ingredients.map((ingredient, index) => (
                <div
                  key={index}
                  onClick={!isEditing ? () => toggleIngredient(index) : undefined}
                  style={{
                    padding: '12px 16px',
                    borderBottom: index < displayRecipe.ingredients.length - 1 ? '1px solid var(--border)' : 'none',
                    display: 'flex', alignItems: 'center', gap: '12px',
                    direction: dir, cursor: isEditing ? 'default' : 'pointer',
                    transition: 'background .12s ease',
                  }}
                >
                  {isEditing ? (
                    <>
                      <input
                        type="text"
                        value={ingredient}
                        onChange={(e) => updateIngredient(index, e.target.value)}
                        className="input"
                        style={{ flex: 1 }}
                      />
                      <button onClick={() => removeIngredient(index)} aria-label="Remove"
                        style={{ flexShrink: 0, width: '30px', height: '30px', background: 'var(--surface-muted)', color: 'var(--ink-secondary)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '15px', cursor: 'pointer' }}>
                        ×
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{
                        flexShrink: 0, width: '20px', height: '20px', borderRadius: '6px',
                        border: checkedIngredients.has(index) ? '1px solid var(--accent)' : '1.5px solid var(--border-strong)',
                        background: checkedIngredients.has(index) ? 'var(--accent)' : 'transparent',
                        display: 'grid', placeItems: 'center', transition: 'all .12s ease',
                      }}>
                        {checkedIngredients.has(index) && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </span>
                      <span style={{
                        fontSize: '15px', color: 'var(--ink)',
                        opacity: checkedIngredients.has(index) ? 0.45 : 1,
                        textDecoration: checkedIngredients.has(index) ? 'line-through' : 'none',
                      }}>
                        {ingredient}
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div style={{ marginBottom: '36px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 className="section-title">Instructions</h2>
              {isEditing && (
                <button onClick={addInstruction} className="btn btn-ghost btn-sm">+ Add</button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {displayRecipe.instructions.map((instruction, index) => (
                <div
                  key={index}
                  onClick={!isEditing ? () => toggleInstruction(index) : undefined}
                  className="card"
                  style={{
                    padding: '14px 16px',
                    display: 'flex', alignItems: 'flex-start', gap: '14px',
                    direction: dir, cursor: isEditing ? 'default' : 'pointer',
                  }}
                >
                  {isEditing ? (
                    <>
                      <span style={{ fontSize: '14px', color: 'var(--ink-muted)', minWidth: '22px', paddingTop: '10px' }}>{index + 1}.</span>
                      <textarea
                        value={instruction}
                        onChange={(e) => updateInstruction(index, e.target.value)}
                        className="textarea"
                        style={{ flex: 1, minHeight: '76px' }}
                      />
                      <button onClick={() => removeInstruction(index)} aria-label="Remove"
                        style={{ flexShrink: 0, width: '30px', height: '30px', background: 'var(--surface-muted)', color: 'var(--ink-secondary)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '15px', cursor: 'pointer' }}>
                        ×
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{
                        flexShrink: 0, width: '26px', height: '26px', borderRadius: '999px',
                        display: 'grid', placeItems: 'center', fontSize: '13px', fontWeight: 600,
                        background: checkedInstructions.has(index) ? 'var(--accent)' : 'var(--surface-muted)',
                        color: checkedInstructions.has(index) ? '#fff' : 'var(--ink-secondary)',
                        border: checkedInstructions.has(index) ? '1px solid var(--accent)' : '1px solid var(--border)',
                        transition: 'all .12s ease',
                      }}>
                        {index + 1}
                      </span>
                      <span style={{
                        fontSize: '15px', color: 'var(--ink)', lineHeight: 1.6, paddingTop: '2px',
                        opacity: checkedInstructions.has(index) ? 0.45 : 1,
                        textDecoration: checkedInstructions.has(index) ? 'line-through' : 'none',
                      }}>
                        {instruction}
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            {!isEditing ? (
              <>
                <button onClick={handleEdit} className="btn btn-primary">Edit recipe</button>
                {!shareLink ? (
                  <button onClick={handleShare} disabled={isSharing} className="btn btn-ghost">
                    {isSharing ? <><span className="spinner" /> Creating…</> : 'Share'}
                  </button>
                ) : (
                  <button onClick={copyShareLink} className="btn btn-ghost" style={{ maxWidth: '100%' }}>
                    {copied ? (
                      <>✓ Copied</>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        Copy share link
                      </>
                    )}
                  </button>
                )}
              </>
            ) : (
              <>
                <button onClick={handleSave} disabled={isSaving} className="btn btn-accent">
                  {isSaving ? <><span className="spinner" /> Saving…</> : 'Save changes'}
                </button>
                <button onClick={handleCancel} disabled={isSaving} className="btn btn-ghost">
                  Cancel
                </button>
                <button onClick={handleDelete} disabled={isSaving || isDeleting} className="btn btn-danger" style={{ marginLeft: 'auto' }}>
                  {isDeleting ? 'Deleting…' : 'Delete'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
