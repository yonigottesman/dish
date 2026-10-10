import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google.cloud import firestore, pubsub, storage
from starlette.middleware.sessions import SessionMiddleware

from app.config import settings
from app.dependencies import NotAuthenticatedException, get_logger
from app.dish import router as dish_router
from app.login import router as login_router

# NOTE: `from google import genai`, the Document AI client, and app.process_dish
# (which transitively imports genai/documentai/bs4/langdetect/PIL) are
# deliberately NOT imported at module level. They are heavy to import on a cold
# disk and are only needed by the background recipe-processing worker, never by
# the user-facing login/recipe-list path. They are imported lazily inside
# warm_heavy_clients() so uvicorn can bind the port (and Cloud Run's startup
# probe can pass) before paying that cost. See lifespan().

# logging.basicConfig(level=logging.INFO)


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


def build_light_clients():
    """Construct the clients used by user-facing recipe routes (off the loop)."""
    return {
        "storage_client": storage.Client(project=settings.GOOGLE_CLOUD_PROJECT),
        "pubsub_publisher": pubsub.PublisherClient(),
        "pubsub_subscriber": pubsub.SubscriberClient(),
    }


async def warmup(_app: FastAPI, logger):
    """Build all Google Cloud clients after the server is already listening.

    Nothing here is on the cold-start critical path: the lifespan returns
    immediately so uvicorn binds the port and Cloud Run's startup probe passes,
    then this runs in the background. Routes that need storage/pubsub await
    `clients_ready` (set as soon as the light clients exist); login and recipe
    listing only need Firestore, which is ready before the first request.

    The heavy genai + Document AI imports (and app.process_dish, which pulls in
    bs4/langdetect/PIL) happen here too, so they never delay startup. They are
    only needed by the background Pub/Sub recipe worker. Best-effort: failures
    are logged, not fatal.
    """
    try:
        # Light clients first, then unblock any waiting user-facing requests.
        light_clients = await asyncio.to_thread(build_light_clients)
        _app.state.storage_client = light_clients["storage_client"]
        _app.state.pubsub_publisher = light_clients["pubsub_publisher"]
        _app.state.pubsub_subscriber = light_clients["pubsub_subscriber"]
        _app.state.clients_ready.set()

        from google import genai
        from google.api_core.client_options import ClientOptions
        from google.cloud import documentai_v1

        from app.process_dish import ProcessDishCallback

        # genai's constructor blocks; build it off the event loop.
        _app.state.genai_client = await asyncio.to_thread(
            genai.Client, vertexai=True, project="personal-ai-264306", location="global"
        )

        # Document AI uses an async gRPC client created on the running loop.
        opts = ClientOptions(
            api_endpoint=f"{settings.DOCUMENT_AI_LOCATION}-documentai.googleapis.com"
        )
        documentai_client = documentai_v1.DocumentProcessorServiceAsyncClient(
            client_options=opts
        )
        _app.state.documentai_client = documentai_client
        _app.state.documentai_processor_name = documentai_client.processor_path(
            settings.GOOGLE_CLOUD_PROJECT,
            settings.DOCUMENT_AI_LOCATION,
            settings.DOCUMENT_AI_PROCESSOR_ID,
        )

        _app.state.pubsub_subscription_path = (
            _app.state.pubsub_subscriber.subscription_path(
                settings.GOOGLE_CLOUD_PROJECT, settings.DISH_JOBS_SUBSCRIPTION_ID
            )
        )
        callback = ProcessDishCallback(
            logger=logger,
            storage_client=_app.state.storage_client,
            genai_client=_app.state.genai_client,
            documentai_processor_name=_app.state.documentai_processor_name,
            documentai_client=_app.state.documentai_client,
            db=_app.state.db,
            loop=asyncio.get_running_loop(),
        )
        # StreamingPull fails asynchronously (e.g. a deleted subscription).
        # Observe that failure and reconnect instead of reporting false readiness.
        while True:
            try:
                await asyncio.to_thread(
                    _app.state.pubsub_subscriber.get_subscription,
                    request={"subscription": _app.state.pubsub_subscription_path},
                    timeout=10,
                )
                future = _app.state.pubsub_subscriber.subscribe(
                    _app.state.pubsub_subscription_path,
                    callback,
                    flow_control=pubsub.types.FlowControl(max_messages=4),
                )
                _app.state.subscribe_future = future
                _app.state.worker_ready.set()
                logger.info("Background recipe worker ready")
                while not future.done():
                    await asyncio.sleep(1)
                future.result()
                raise RuntimeError("Recipe subscriber stopped unexpectedly")
            except Exception:
                _app.state.worker_ready.clear()
                logger.exception(
                    "Recipe subscriber unavailable; retrying in 10 seconds"
                )
                await asyncio.sleep(10)
    except Exception as e:
        logger.exception(f"Background warmup failed: {e}")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger = get_logger()
    _app.state.db = firestore.AsyncClient(
        project=settings.GOOGLE_CLOUD_PROJECT, database="dishdbeu"
    )
    # Gate for routes needing storage/pubsub; set once the light clients exist.
    _app.state.clients_ready = asyncio.Event()
    _app.state.worker_ready = asyncio.Event()

    # Everything heavy runs in the background so the lifespan returns immediately
    # and uvicorn binds the port (passing Cloud Run's startup probe) right away.
    warm_task = asyncio.create_task(warm_firestore(_app.state.db, logger))
    warmup_task = asyncio.create_task(warmup(_app, logger))

    yield

    # Shutdown: stop background tasks and the subscriber.
    warm_task.cancel()
    warmup_task.cancel()
    future = getattr(_app.state, "subscribe_future", None)
    if future:
        future.cancel()


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
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"status": "error", "detail": "Authentication required"},
    )


app.add_exception_handler(NotAuthenticatedException, exc_handler)
