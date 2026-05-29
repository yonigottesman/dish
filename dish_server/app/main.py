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


def build_documentai_client():
    opts = ClientOptions(api_endpoint=f"{settings.DOCUMENT_AI_LOCATION}-documentai.googleapis.com")
    client = documentai_v1.DocumentProcessorServiceAsyncClient(client_options=opts)
    processor_name = client.processor_path(
        settings.GOOGLE_CLOUD_PROJECT, settings.DOCUMENT_AI_LOCATION, settings.DOCUMENT_AI_PROCESSOR_ID
    )
    return processor_name, client


async def warm_firestore(db: firestore.AsyncClient, logger):
    """Establish the Firestore gRPC channel + auth token during startup.

    On a cold start the first Firestore call pays a one-time ~2-3s cost to fetch
    credentials and open the channel. Doing a tiny throwaway read here, in the
    background, moves that cost off the user's first request (the warmed channel
    and cached credentials are reused by all later calls on the same client).
    Best-effort: never fail startup if warmup errors.
    """
    try:
        await db.collection("users").limit(1).get()
        logger.info("Firestore connection warmed")
    except Exception as e:
        logger.warning(f"Firestore warmup failed (continuing): {e}")


def build_sync_clients():
    """Construct the synchronous Google Cloud clients.

    These constructors block (~0.3s each). Running them together in a worker
    thread lets the Firestore warmup and the async Document AI client setup
    proceed concurrently instead of serializing on the event loop.
    """
    return {
        "genai_client": genai.Client(vertexai=True, project="personal-ai-264306", location="global"),
        "storage_client": storage.Client(project=settings.GOOGLE_CLOUD_PROJECT),
        "pubsub_publisher": pubsub.PublisherClient(),
        "pubsub_subscriber": pubsub.SubscriberClient(),
    }


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger = get_logger()
    _app.state.db = firestore.AsyncClient(project=settings.GOOGLE_CLOUD_PROJECT, database="dishdbeu")

    # Kick off the Firestore warmup first so its one-time auth + channel cost
    # overlaps with the client construction below and with the first request.
    warm_task = asyncio.create_task(warm_firestore(_app.state.db, logger))

    # Build the synchronous clients off the event loop (concurrent with warmup).
    sync_clients = await asyncio.to_thread(build_sync_clients)
    _app.state.genai_client = sync_clients["genai_client"]
    _app.state.storage_client = sync_clients["storage_client"]
    _app.state.pubsub_publisher = sync_clients["pubsub_publisher"]
    _app.state.pubsub_subscriber = sync_clients["pubsub_subscriber"]

    # Document AI uses an async gRPC client, which must be created on the running
    # event loop, so keep it here (construction is local-only, no network).
    _app.state.documentai_processor_name, _app.state.documentai_client = build_documentai_client()

    _app.state.pubsub_subscription_path = _app.state.pubsub_subscriber.subscription_path(
        settings.GOOGLE_CLOUD_PROJECT, settings.DISH_JOBS_SUBSCRIPTION_ID
    )

    # Get the current event loop to pass to the callback
    loop = asyncio.get_running_loop()

    future = _app.state.pubsub_subscriber.subscribe(
        _app.state.pubsub_subscription_path,
        ProcessDishCallback(
            logger=logger,
            storage_client=_app.state.storage_client,
            genai_client=_app.state.genai_client,
            documentai_processor_name=_app.state.documentai_processor_name,
            documentai_client=_app.state.documentai_client,
            db=_app.state.db,
            loop=loop,
        ),
    )
    yield

    # Shutdown: Close the clients
    warm_task.cancel()
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
    # QA frontend URLs
    "https://dish-web-qa-wkokxyye6a-ew.a.run.app",
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
