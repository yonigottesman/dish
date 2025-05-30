'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { ApiService, Recipe } from './services/api';
import { useRouter } from 'next/navigation';
import { useAuth } from './context/auth-context';
import ProtectedRoute from './components/protected-route';

export default function Home() {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'text' | 'link' | 'image'>('link');
  const [linkInput, setLinkInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        setLoading(true);
        const fetchedRecipes = await ApiService.getAllRecipes();
        setRecipes(fetchedRecipes);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch recipes:', err);
        setError('Failed to load recipes. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchRecipes();
  }, []);

  const handleAddFromLink = async () => {
    if (!linkInput.trim()) return;
    
    try {
      setIsSubmitting(true);
      const newRecipe = await ApiService.addDishFromLink(linkInput.trim());
      setShowModal(false);
      setLinkInput('');
      router.push(`/recipe/${newRecipe.dish_id}`);
    } catch (err) {
      console.error('Failed to add recipe from link:', err);
      alert('Failed to add recipe from link. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
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
              onClick={() => setShowModal(false)}
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
          <div style={{ padding: '20px' }}>
            {activeTab === 'text' && (
              <div style={{ textAlign: 'center', color: '#666', padding: '40px 20px' }}>
                Text input coming soon...
              </div>
            )}

            {activeTab === 'link' && (
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#37352f',
                }}>
                  Recipe URL
                </label>
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
                    marginBottom: '16px',
                    boxSizing: 'border-box',
                  }}
                  disabled={isSubmitting}
                />
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setShowModal(false)}
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
                  <button
                    onClick={handleAddFromLink}
                    disabled={!linkInput.trim() || isSubmitting}
                    style={{
                      padding: '8px 16px',
                      background: !linkInput.trim() || isSubmitting ? '#ccc' : '#37352f',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: !linkInput.trim() || isSubmitting ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    {isSubmitting && (
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid transparent',
                        borderTop: '2px solid white',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                      }} />
                    )}
                    {isSubmitting ? 'Adding...' : 'Add Recipe'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'image' && (
              <div style={{ textAlign: 'center', color: '#666', padding: '40px 20px' }}>
                Image upload coming soon...
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
      {/* Navigation Bar */}
      <nav style={{
        background: '#f7f6f3',
        borderBottom: '1px solid #e9e9e7',
        padding: '12px 20px'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {user?.username && (
                <span style={{ fontSize: '14px', color: '#666' }}>
                  Hello, {user.full_name || user.username}
                </span>
              )}
              <button
                onClick={() => ApiService.logout()}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  color: '#666',
                  border: '1px solid #e9e9e7',
                  borderRadius: '3px',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

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
