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

## Running the Full Stack Locally with Docker

This is the verified, end-to-end recipe for building and running both containers
locally and signing in. It assumes Docker Desktop is running and the gcloud CLI is
authenticated (`gcloud auth list` shows the desired account, and
`~/.config/gcloud/application_default_credentials.json` exists — created via
`gcloud auth application-default login`).

### 1. Build both images
The frontend bakes `NEXT_PUBLIC_API_URL` at build time (its default points at the
production API), so it MUST be built with the local backend URL:
```bash
docker build -f dish_server/Dockerfile -t dish_server dish_server/
docker build -f dish_web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=http://localhost:8000 -t dish_web dish_web/
```

### 2. Run the backend (with Google Cloud credentials mounted)
The backend talks to Firestore, Vertex AI, Document AI, Storage, and Pub/Sub, so it
needs Application Default Credentials. Mount the host ADC file into the container and
point `GOOGLE_APPLICATION_CREDENTIALS` at it. No extra service-account key is needed —
the existing user ADC (an `authorized_user` credential with a quota project) is enough.
```bash
docker rm -f dish_backend 2>/dev/null
docker run -d --name dish_backend \
  -p 8000:8080 \
  -v "$HOME/.config/gcloud/application_default_credentials.json:/tmp/adc.json:ro" \
  -e GOOGLE_APPLICATION_CREDENTIALS=/tmp/adc.json \
  -e GOOGLE_CLOUD_PROJECT=personal-ai-264306 \
  -e IS_PRODUCTION=false \
  dish_server
```
Defaults in `app/config.py` (project, Firestore DB `dishdbeu`, Document AI processor,
GCS bucket, OAuth client ID) are correct for local dev, so only the env vars above are
required. Verify with: `curl -i http://localhost:8000/login` (expect HTTP 200).

### 3. Run the frontend
```bash
docker rm -f dish_frontend 2>/dev/null
docker run -d --name dish_frontend -p 3000:3000 dish_web
```
Open http://localhost:3000 — it redirects to `/login`.

### 4. Logging in with Google
Auth uses Google Identity Services (browser) → backend `/auth/google`, which verifies
the ID token against `GOOGLE_CLIENT_ID` and sets an `access-token` cookie.

- **Manual:** click "Continue with Google" and pick your account. Note the button uses
  Google's `renderButton` flow, which opens the account chooser in a SEPARATE popup
  window (cross-origin `accounts.google.com`) — this is outside any single-tab browser
  automation and must be clicked by a human (unless One Tap auto-selects an existing
  session).
- **Fully automated (no click), via One Tap in the page console** — works when the
  browser already has a single, consented Google session for this app:
  ```js
  google.accounts.id.initialize({
    client_id: "941271455567-19rfpkdkgrvjrla9uf56l2e4tf6j29gh.apps.googleusercontent.com",
    auto_select: true,
    callback: async (resp) => {
      const r = await fetch("http://localhost:8000/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ credential: resp.credential }),
      });
      const data = await r.json();
      if (data.user) localStorage.setItem("dish_auth_user", JSON.stringify(data.user));
      location.href = "/";
    },
  });
  google.accounts.id.prompt();
  ```
  On success the prompt resolves with `dismissedReason: "credential_returned"` and the
  backend logs `Google authentication successful for user <email>`. First-ever consent
  for the app still requires a one-time manual approval in Google's window.

### Useful commands
```bash
docker ps --filter name=dish_              # status of both containers
docker logs dish_backend | tail -30        # backend startup + auth logs
docker logs dish_frontend | tail -10       # Next.js logs
docker rm -f dish_backend dish_frontend    # stop and clean up
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