'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { ApiService, Recipe } from './services/api';

export default function Home() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          <div style={{ marginBottom: '48px' }}>
            <h1 style={{ 
              fontSize: '32px', 
              fontWeight: '600', 
              color: '#37352f',
              marginBottom: '8px',
              margin: '0 0 8px 0'
            }}>
              Recipes
            </h1>
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
    </div>
  );
}
