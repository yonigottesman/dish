# Dish Recipe App

A full-stack recipe application with a Next.js frontend and FastAPI backend.

## Project Structure

```
dish/
├── dish_web/          # Next.js frontend
│   ├── app/
│   │   ├── config/    # API configuration
│   │   ├── services/  # API service layer
│   │   └── ...
│   └── package.json
├── dish_server/       # FastAPI backend
│   └── main.py
└── README.md
```

## Getting Started

### Backend (FastAPI)

1. Navigate to the server directory:
   ```bash
   cd dish_server
   ```

2. Install dependencies:
   ```bash
   pip install fastapi uvicorn
   ```

3. Run the server:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

   The API will be available at `http://0.0.0.0:8000`

### Frontend (Next.js)

1. Navigate to the web directory:
   ```bash
   cd dish_web
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

   The web app will be available at `http://localhost:3000`

## API Endpoints

- `GET /` - Health check
- `GET /all_dishes` - Get all recipes
- `GET /dish/{dish_id}` - Get a specific recipe by ID

## Configuration

The frontend API configuration is located in `dish_web/app/config/api.ts`. Currently set to:
- Base URL: `http://localhost:8000`
- TODO: Replace with environment variable in production

## Troubleshooting

If you encounter "Failed to fetch" errors:

1. **Ensure the backend server is running**:
   ```bash
   cd dish_server
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

2. **Check the server is responding**:
   ```bash
   curl http://localhost:8000/all_dishes
   ```

3. **Verify CORS configuration**: The server is configured to accept requests from:
   - `http://localhost:3000` (default Next.js port)
   - `http://localhost:3001` (alternative Next.js port)

4. **Check browser console**: Open browser dev tools to see detailed error messages and debug logs.

## Features

- View all recipes
- View individual recipe details with ingredients and instructions
- Responsive design
- Error handling and loading states
- Clean separation between frontend and backend

## Development Notes

- The backend serves recipe data via REST API
- The frontend uses React hooks for state management
- CORS is configured to allow requests from the Next.js development server
- All mock data has been moved from frontend to backend # dish
