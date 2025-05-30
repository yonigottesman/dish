import logging

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.sessions import SessionMiddleware

from app.config import settings
from app.dependencies import NotAuthenticatedException
from app.dish import router as dish_router
from app.login import router as login_router

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

app.include_router(login_router)
app.include_router(dish_router)


# Add CORS middleware to allow all requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Using wildcard to allow any frontend
    allow_credentials=True,  # Changed to True to support cookies
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# Add middleware to log all requests
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Request: {request.method} {request.url}")
    logger.info(f"Headers: {dict(request.headers)}")
    response = await call_next(request)
    logger.info(f"Response status: {response.status_code}")
    return response


app.add_middleware(SessionMiddleware, secret_key=settings.SECRET_KEY)


def exc_handler(request, exc):
    # Return error response instead of redirect
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED, content={"status": "error", "detail": "Authentication required"}
    )


app.add_exception_handler(NotAuthenticatedException, exc_handler)
