# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a recipe management application called "Dish" with two main components:
- **Backend** (`dish_server/`): FastAPI Python server with Google Cloud integration
- **Frontend** (`dish_web/`): Next.js React application with TypeScript

The app allows users to save recipes from URLs, text, or images using AI-powered extraction and OCR.

## Important:
* The frontend and backend servers are already running, you can examine the logs in
  * dish_web/app.log
  * dish_server/app.log
* The frontend and backend are running on the same machine, you can access them at
  * http://localhost:3000
  * http://localhost:8000


## Development Commands

### Frontend (dish_web/)
```bash
cd dish_web
npm run dev          # Start development server with turbopack
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Backend (dish_server/)
```bash
cd dish_server
# Uses uv for Python dependency management
ruff check           # Lint Python code
ruff format          # Format Python code
```

### Docker
```bash
# Backend
docker build -f dish_server/Dockerfile -t dish_server dish_server/
docker run -p 8000:8080 dish_server

# Frontend  
docker build -f dish_web/Dockerfile -t dish_web dish_web/
```

## Architecture

### Backend Structure
- `app/main.py` - FastAPI application with Google Cloud clients (Firestore, Document AI, GenAI, Storage)
- `app/dish.py` - Recipe management endpoints
- `app/login.py` - Authentication with Google OAuth
- `app/models.py` - Pydantic models for data validation
- `app/crud.py` - Database operations with Firestore
- `app/security.py` - JWT and session management
- `app/dependencies.py` - Dependency injection for auth

### Frontend Structure
- `app/` - Next.js app directory structure
- `app/services/api.ts` - API client for backend communication
- `app/context/auth-context.tsx` - Authentication state management
- `app/components/` - Reusable React components
- `app/utils/` - Utility functions (image processing, etc.)

### Key Features
- Recipe extraction from URLs using web scraping
- OCR processing of recipe images via Google Document AI
- AI-powered recipe parsing with Google GenAI
- User authentication with Google OAuth
- Image upload and storage with Google Cloud Storage
- Progress tracking for long-running operations

## Environment Setup

### Backend Environment Variables
See `dish_server/env.example` for required Google Cloud configuration:
- `GOOGLE_CLOUD_PROJECT` - GCP project ID
- `DOCUMENT_AI_PROCESSOR_ID` - Document AI processor for OCR
- `DOCUMENT_AI_LOCATION` - Document AI region
- `SECRET_KEY` - Session encryption key

### Frontend Environment Variables  
See `dish_web/env.local.example` for API configuration:
- `NEXT_PUBLIC_API_URL` - Backend API URL
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` - Google OAuth client ID

## Development Notes

- The application assumes server and web app are already running - don't try to start them
- Backend uses async FastAPI with Google Cloud services initialized at startup
- Frontend uses Next.js 15 with React 19 and Tailwind CSS v4
- Authentication uses session-based cookies with JWT tokens
- API responses include proper error handling for 401 (auth required) status codes
- Images are processed with orientation correction and uploaded to Google Cloud Storage