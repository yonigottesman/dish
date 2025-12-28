import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google import genai
from google.api_core.client_options import ClientOptions
from google.cloud import documentai_v1, firestore, pubsub, storage
from starlette.middleware.sessions import SessionMiddleware

from app.config import settings
from app.dependencies import NotAuthenticatedException, get_logger
from app.dish import router as dish_router
from app.login import router as login_router
from app.process_dish import ProcessDishCallback

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
async def lifespan(_app: FastAPI):
    _app.state.db = firestore.AsyncClient(project=settings.GOOGLE_CLOUD_PROJECT, database="dishdbeu")
    _app.state.genai_client = genai.Client(vertexai=True, project="personal-ai-264306", location="us-central1")
    _app.state.documentai_processor, _app.state.documentai_client = await build_documentai_processor()
    _app.state.storage_client = storage.Client(project=settings.GOOGLE_CLOUD_PROJECT)

    _app.state.pubsub_publisher = pubsub.PublisherClient()
    _app.state.pubsub_subscriber = pubsub.SubscriberClient()
    _app.state.pubsub_subscription_path = _app.state.pubsub_subscriber.subscription_path(
        settings.GOOGLE_CLOUD_PROJECT, settings.DISH_JOBS_SUBSCRIPTION_ID
    )

    # Get the current event loop to pass to the callback
    loop = asyncio.get_running_loop()

    future = _app.state.pubsub_subscriber.subscribe(
        _app.state.pubsub_subscription_path,
        ProcessDishCallback(
            logger=get_logger(),
            storage_client=_app.state.storage_client,
            genai_client=_app.state.genai_client,
            documentai_processor=_app.state.documentai_processor,
            documentai_client=_app.state.documentai_client,
            db=_app.state.db,
            loop=loop,
        ),
    )
    yield

    # Shutdown: Close the clients
    if future:
        future.cancel()
        future.result()  # Wait for it to stop


app = FastAPI(lifespan=lifespan)

app.include_router(login_router)
app.include_router(dish_router)


# Add CORS middleware to allow all requests
development_origins = [
    "http://localhost:3000",  # React/Next.js dev server default
    "http://localhost:3001",  # Alternative React port
    "http://localhost:5173",  # Vite dev server default
    "http://127.0.0.1:3000",  # Alternative localhost format
    "http://127.0.0.1:3001",  # Alternative localhost format
    "http://127.0.0.1:5173",  # Alternative localhost format
    "https://localhost:3000",  # HTTPS versions
    "https://localhost:3001",
    "https://localhost:5173",
]

production_origins = [
    "http://localhost:3000",  # Allow local frontend to connect to prod backend for development
    "https://localhost:3000",
    # Production frontend URLs
    "https://dish-web-941271455567.europe-west1.run.app",
    "http://dish.yonigo.co",
    "https://dish.yonigo.co",
]

# Choose origins based on environment
allowed_origins = production_origins if settings.IS_PRODUCTION else development_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    # Remove the allow_origin_regex to avoid security issues
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
