import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google import genai
from google.api_core.client_options import ClientOptions
from google.cloud import documentai_v1, firestore, storage
from starlette.middleware.sessions import SessionMiddleware

from app.config import settings
from app.dependencies import NotAuthenticatedException
from app.dish import router as dish_router
from app.login import router as login_router

# logging.basicConfig(level=logging.INFO)


async def build_documentai_processor():
    project_id = settings.GOOGLE_CLOUD_PROJECT
    opts = ClientOptions(api_endpoint=f"{settings.DOCUMENT_AI_LOCATION}-documentai.googleapis.com")
    client = documentai_v1.DocumentProcessorServiceAsyncClient(client_options=opts)
    full_processor_name = client.processor_path(
        project_id, settings.DOCUMENT_AI_LOCATION, settings.DOCUMENT_AI_PROCESSOR_ID
    )
    request = documentai_v1.GetProcessorRequest(name=full_processor_name)
    processor = await client.get_processor(request=request)

    return processor, client


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create the Firestore client once. super slow init otherwise
    app.state.db = firestore.AsyncClient(project=settings.GOOGLE_CLOUD_PROJECT, database="dishdbeu")
    app.state.genai_client = genai.Client(vertexai=True, project="personal-ai-264306", location="us-central1")
    app.state.documentai_processor, app.state.documentai_client = await build_documentai_processor()
    app.state.storage_client = storage.Client(project=settings.GOOGLE_CLOUD_PROJECT)
    yield

    # Shutdown: Close the clients
    #    ...


app = FastAPI(lifespan=lifespan)

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


# # Add middleware to log all requests
# @app.middleware("http")
# async def log_requests(request: Request, call_next):
#     # logger.info(f"Request: {request.method} {request.url}")
#     # logger.info(f"Headers: {dict(request.headers)}")
#     response = await call_next(request)
#     # logger.info(f"Response status: {response.status_code}")
#     return response


app.add_middleware(SessionMiddleware, secret_key=settings.SECRET_KEY)


def exc_handler(request, exc):
    # Return error response instead of redirect
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED, content={"status": "error", "detail": "Authentication required"}
    )


app.add_exception_handler(NotAuthenticatedException, exc_handler)
