'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import { ApiService, Recipe } from '../../services/api';
import { useAuth } from '../../context/auth-context';
import ProtectedRoute from '../../components/protected-route';
import Navbar from '../../components/navbar';

type NotesStatus = 'saved' | 'saving' | 'dirty' | 'error';

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
      gap: '8px',
      marginBottom: '32px',
      maxWidth: '400px',
      margin: '0 auto 32px',
    }}>
      {imageIds.map((imageId, index) => (
        <div
          key={imageId}
          style={{
            position: 'relative',
            borderRadius: '6px',
            overflow: 'hidden',
            border: '1px solid #e5e5e5',
          }}
        >
          <img
            src={ApiService.getImageUrl(imageId)}
            alt={`Recipe image ${index + 1}`}
            style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
          />
          {isEditing && onDeleteImage && (
            <button
              onClick={() => onDeleteImage(imageId)}
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: '#1a1a1a',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  const [notesDraft, setNotesDraft] = useState('');
  const [notesStatus, setNotesStatus] = useState<NotesStatus>('saved');
  const lastSavedNotesRef = useRef('');
  const notesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const deleteConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const clearDeleteConfirmTimer = () => {
    if (deleteConfirmTimerRef.current) {
      clearTimeout(deleteConfirmTimerRef.current);
      deleteConfirmTimerRef.current = null;
    }
  };

  const handleDelete = async () => {
    if (!recipe) return;
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      clearDeleteConfirmTimer();
      deleteConfirmTimerRef.current = setTimeout(() => setDeleteConfirm(false), 4000);
      return;
    }
    clearDeleteConfirmTimer();
    try {
      setIsDeleting(true);
      await ApiService.deleteRecipe(recipeId);
      window.location.href = '/';
    } catch (err) {
      console.error('Failed to delete recipe:', err);
      alert('Failed to delete recipe. Please try again.');
      setDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const saveNotesNow = useCallback(async (value: string) => {
    if (value === lastSavedNotesRef.current) {
      setNotesStatus('saved');
      return;
    }
    try {
      setNotesStatus('saving');
      await ApiService.updateNotes(recipeId, value);
      lastSavedNotesRef.current = value;
      setNotesStatus('saved');
      setRecipe((prev) => (prev ? { ...prev, notes: value } : prev));
    } catch (err) {
      console.error('Failed to save notes:', err);
      setNotesStatus('error');
    }
  }, [recipeId]);

  const handleNotesChange = (value: string) => {
    setNotesDraft(value);
    setNotesStatus('dirty');
    if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current);
    notesDebounceRef.current = setTimeout(() => saveNotesNow(value), 1200);
  };

  const handleNotesBlur = () => {
    if (notesDebounceRef.current) {
      clearTimeout(notesDebounceRef.current);
      notesDebounceRef.current = null;
    }
    if (notesDraft !== lastSavedNotesRef.current) {
      saveNotesNow(notesDraft);
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
        const initialNotes = fetchedRecipe?.notes ?? '';
        setNotesDraft(initialNotes);
        lastSavedNotesRef.current = initialNotes;
        setNotesStatus('saved');
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

  useEffect(() => {
    return () => {
      if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current);
      if (deleteConfirmTimerRef.current) clearTimeout(deleteConfirmTimerRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#fff' }}>
        <Navbar />
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '60px 20px', textAlign: 'center', color: '#999', fontSize: '14px' }}>
          Loading...
        </div>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div style={{ minHeight: '100vh', background: '#fff' }}>
        <Navbar />
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
          <p style={{ color: '#999', fontSize: '14px', marginBottom: '16px' }}>{error || 'Recipe not found'}</p>
          <Link href="/" style={{ color: '#1a1a1a', fontSize: '13px' }}>Back to recipes</Link>
        </div>
      </div>
    );
  }

  const displayRecipe = isEditing ? editedRecipe! : recipe;
  const isHebrew = displayRecipe.language === 'he';

  const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #e5e5e5',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
    color: '#1a1a1a',
  };

  return (
    <ProtectedRoute>
      <div style={{ minHeight: '100vh', background: '#fff' }}>
        <Navbar />

        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
          {/* Title */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
              {isEditing ? (
                <>
                  <input
                    type="text"
                    value={displayRecipe.emoji || ''}
                    onChange={(e) => updateEditedField('emoji', e.target.value)}
                    placeholder="🍽️"
                    style={{ ...inputStyle, width: '60px', textAlign: 'center', fontSize: '32px', padding: '8px' }}
                  />
                  <input
                    type="text"
                    value={displayRecipe.title}
                    onChange={(e) => updateEditedField('title', e.target.value)}
                    style={{ ...inputStyle, flex: 1, fontSize: '28px', fontWeight: '600', direction: isHebrew ? 'rtl' : 'ltr' }}
                  />
                </>
              ) : (
                <>
                  {displayRecipe.emoji && <span style={{ fontSize: '32px' }}>{displayRecipe.emoji}</span>}
                  <h1 style={{ fontSize: '32px', fontWeight: '600', color: '#1a1a1a', margin: 0, direction: isHebrew ? 'rtl' : 'ltr' }}>
                    {displayRecipe.title}
                  </h1>
                </>
              )}
            </div>

            {isEditing ? (
              <textarea
                value={displayRecipe.description}
                onChange={(e) => updateEditedField('description', e.target.value)}
                style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', direction: isHebrew ? 'rtl' : 'ltr' }}
              />
            ) : (
              <p style={{ fontSize: '16px', color: '#6b6b6b', margin: 0, lineHeight: '1.6', direction: isHebrew ? 'rtl' : 'ltr' }}>
                {displayRecipe.description}
              </p>
            )}

            {isEditing && (
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: '#6b6b6b' }}>Language:</span>
                <select
                  value={displayRecipe.language || 'en'}
                  onChange={(e) => updateEditedField('language', e.target.value)}
                  style={{ ...inputStyle, width: 'auto', padding: '6px 10px' }}
                >
                  <option value="en">English</option>
                  <option value="he">Hebrew</option>
                </select>
              </div>
            )}

            {recipe.link && (
              <div style={{ marginTop: '12px' }}>
                {isEditing ? (
                  <input
                    type="url"
                    value={displayRecipe.link || ''}
                    onChange={(e) => updateEditedField('link', e.target.value)}
                    placeholder="https://..."
                    style={inputStyle}
                  />
                ) : (
                  <a href={recipe.link} target="_blank" rel="noopener noreferrer" style={{ color: '#6b6b6b', fontSize: '13px' }}>
                    Source link
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
                style={{
                  border: '1px dashed #e5e5e5',
                  borderRadius: '6px',
                  padding: '20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
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
                <div style={{ color: '#999', fontSize: '13px' }}>Drop images or click to upload</div>
              </div>

              {newImagePreviews.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '12px' }}>
                  {newImagePreviews.map((preview, index) => (
                    <div key={index} style={{ position: 'relative', borderRadius: '6px', overflow: 'hidden', border: '1px solid #e5e5e5', aspectRatio: '1' }}>
                      <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        onClick={() => removeNewImage(index)}
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: '#1a1a1a',
                          color: '#fff',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '12px',
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
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1a1a1a', margin: 0 }}>Ingredients</h2>
              {isEditing && (
                <button onClick={addIngredient} style={{ padding: '6px 12px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>
                  + Add
                </button>
              )}
            </div>
            <div style={{ border: '1px solid #e5e5e5', borderRadius: '8px', overflow: 'hidden' }}>
              {displayRecipe.ingredients.map((ingredient, index) => (
                <div
                  key={index}
                  style={{
                    padding: '12px 16px',
                    borderBottom: index < displayRecipe.ingredients.length - 1 ? '1px solid #e5e5e5' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    direction: isHebrew ? 'rtl' : 'ltr',
                  }}
                >
                  {isEditing ? (
                    <>
                      <input
                        type="text"
                        value={ingredient}
                        onChange={(e) => updateIngredient(index, e.target.value)}
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      <button onClick={() => removeIngredient(index)} style={{ padding: '4px 10px', background: '#e5e5e5', color: '#1a1a1a', border: 'none', borderRadius: '4px', fontSize: '14px', cursor: 'pointer' }}>
                        ×
                      </button>
                    </>
                  ) : (
                    <>
                      <input
                        type="checkbox"
                        checked={checkedIngredients.has(index)}
                        onChange={() => toggleIngredient(index)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '15px', color: '#1a1a1a', opacity: checkedIngredients.has(index) ? 0.5 : 1, textDecoration: checkedIngredients.has(index) ? 'line-through' : 'none' }}>
                        {ingredient}
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1a1a1a', margin: 0 }}>Instructions</h2>
              {isEditing && (
                <button onClick={addInstruction} style={{ padding: '6px 12px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>
                  + Add
                </button>
              )}
            </div>
            <div style={{ border: '1px solid #e5e5e5', borderRadius: '8px', overflow: 'hidden' }}>
              {displayRecipe.instructions.map((instruction, index) => (
                <div
                  key={index}
                  style={{
                    padding: '14px 16px',
                    borderBottom: index < displayRecipe.instructions.length - 1 ? '1px solid #e5e5e5' : 'none',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    direction: isHebrew ? 'rtl' : 'ltr',
                  }}
                >
                  {isEditing ? (
                    <>
                      <span style={{ fontSize: '14px', color: '#999', minWidth: '24px' }}>{index + 1}.</span>
                      <textarea
                        value={instruction}
                        onChange={(e) => updateInstruction(index, e.target.value)}
                        style={{ ...inputStyle, flex: 1, minHeight: '80px', resize: 'vertical' }}
                      />
                      <button onClick={() => removeInstruction(index)} style={{ padding: '4px 10px', background: '#e5e5e5', color: '#1a1a1a', border: 'none', borderRadius: '4px', fontSize: '14px', cursor: 'pointer' }}>
                        ×
                      </button>
                    </>
                  ) : (
                    <>
                      <input
                        type="checkbox"
                        checked={checkedInstructions.has(index)}
                        onChange={() => toggleInstruction(index)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', marginTop: '3px' }}
                      />
                      <span style={{ fontSize: '15px', color: '#1a1a1a', lineHeight: '1.6', opacity: checkedInstructions.has(index) ? 0.5 : 1, textDecoration: checkedInstructions.has(index) ? 'line-through' : 'none' }}>
                        {instruction}
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1a1a1a', margin: 0 }}>Notes</h2>
              <span
                style={{
                  fontSize: '12px',
                  color: notesStatus === 'error' ? '#c0392b' : '#999',
                  minHeight: '16px',
                }}
              >
                {notesStatus === 'saving' && 'Saving…'}
                {notesStatus === 'dirty' && 'Editing…'}
                {notesStatus === 'saved' && lastSavedNotesRef.current ? 'Saved' : ''}
                {notesStatus === 'error' && 'Failed to save'}
              </span>
            </div>
            <textarea
              value={notesDraft}
              onChange={(e) => handleNotesChange(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Private notes — tips, variations, what worked last time…"
              style={{
                width: '100%',
                minHeight: '100px',
                padding: '12px 14px',
                border: '1px solid #e5e5e5',
                borderRadius: '8px',
                fontSize: '15px',
                lineHeight: '1.6',
                color: '#1a1a1a',
                background: '#fafafa',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
                direction: isHebrew ? 'rtl' : 'ltr',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ borderTop: '1px solid #e5e5e5', paddingTop: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {!isEditing ? (
              <>
                <button
                  onClick={handleEdit}
                  style={{
                    padding: '10px 20px',
                    background: '#1a1a1a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  Edit Recipe
                </button>
                {!shareLink ? (
                  <button
                    onClick={handleShare}
                    disabled={isSharing}
                    style={{
                      padding: '10px 20px',
                      background: '#fff',
                      color: '#1a1a1a',
                      border: '1px solid #e5e5e5',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      opacity: isSharing ? 0.5 : 1,
                    }}
                  >
                    {isSharing ? 'Creating...' : 'Create Share Link'}
                  </button>
                ) : (
                  <div
                    onClick={() => {
                      navigator.clipboard.writeText(shareLink).catch(() => {});
                    }}
                    style={{
                      padding: '10px 12px',
                      border: '1px solid #e5e5e5',
                      borderRadius: '6px',
                      fontSize: '13px',
                      color: '#1a1a1a',
                      background: '#fafafa',
                      cursor: 'pointer',
                      userSelect: 'all',
                      WebkitUserSelect: 'all',
                      wordBreak: 'break-all',
                    }}
                  >
                    {shareLink}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  style={{
                    padding: '10px 20px',
                    background: deleteConfirm ? '#c0392b' : '#fff',
                    color: deleteConfirm ? '#fff' : '#c0392b',
                    border: `1px solid ${deleteConfirm ? '#c0392b' : '#e5c3c3'}`,
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    marginLeft: 'auto',
                    minHeight: '44px',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                    opacity: isDeleting ? 0.5 : 1,
                  }}
                >
                  {isDeleting ? 'Deleting…' : deleteConfirm ? 'Tap again to confirm' : 'Delete'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  style={{
                    padding: '10px 20px',
                    background: '#fff',
                    color: '#6b6b6b',
                    border: '1px solid #e5e5e5',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    opacity: isSaving ? 0.5 : 1,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  style={{
                    padding: '10px 20px',
                    background: '#1a1a1a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    opacity: isSaving ? 0.5 : 1,
                  }}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSaving || isDeleting}
                  style={{
                    padding: '10px 20px',
                    background: deleteConfirm ? '#c0392b' : '#fff',
                    color: deleteConfirm ? '#fff' : '#c0392b',
                    border: `1px solid ${deleteConfirm ? '#c0392b' : '#e5c3c3'}`,
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    marginLeft: 'auto',
                    minHeight: '44px',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                    opacity: (isSaving || isDeleting) ? 0.5 : 1,
                  }}
                >
                  {isDeleting ? 'Deleting…' : deleteConfirm ? 'Tap again to confirm' : 'Delete'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
