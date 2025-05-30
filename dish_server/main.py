import logging
import os
import re
import textwrap
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Dict, List, Optional

import aiohttp
import jwt
from bs4 import BeautifulSoup
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.security.utils import get_authorization_scheme_param
from google import genai
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from jwt.exceptions import InvalidTokenError
from passlib.context import CryptContext
from pydantic import BaseModel, Field
from starlette.middleware.sessions import SessionMiddleware
from starlette.status import HTTP_401_UNAUTHORIZED

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()


class RecipeModel(BaseModel):
    dish_id: str
    title: str
    description: str
    ingredients: List[str]
    instructions: List[str]
    link: str | None = None
    emoji: str | None = None


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


# Recipe data structure
fake_db: Dict[str, RecipeModel] = {}


# to get a string like this run:
# openssl rand -hex 32
SECRET_KEY = "718d52839994c9e0e1351831dc252f25a51d6e690940601393878f37a585b65d"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Google OAuth config
GOOGLE_CLIENT_ID = os.environ.get(
    "GOOGLE_CLIENT_ID", "941271455567-19rfpkdkgrvjrla9uf56l2e4tf6j29gh.apps.googleusercontent.com"
)

fake_users_db = {
    "johndoe": {
        "username": "johndoe",
        "full_name": "John Doe",
        "email": "johndoe@example.com",
        "hashed_password": "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW",
    }
}


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: str | None = None


class User(BaseModel):
    username: str
    email: str | None = None
    full_name: str | None = None


class UserInDB(User):
    hashed_password: str | None = None


class UserCreate(BaseModel):
    username: str
    password: str
    email: str | None = None
    full_name: str | None = None


class GoogleTokenRequest(BaseModel):
    credential: str


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class OAuth2PasswordBearerWithCookieOrHeader(OAuth2PasswordBearer):
    def __init__(
        self,
        tokenUrl: str,
        scheme_name: Optional[str] = None,
        scopes: Optional[dict[str, str]] = None,
        auto_error: bool = True,
        cookie_name: str = "access-token",
    ):
        self.cookie_name = cookie_name
        super().__init__(tokenUrl=tokenUrl, scheme_name=scheme_name, scopes=scopes, auto_error=auto_error)

    async def __call__(self, request: Request) -> Optional[str]:
        # Log the request headers and cookies for debugging
        logger.info(f"Auth Headers: {dict(request.headers)}")
        logger.info(f"Auth Cookies: {dict(request.cookies)}")

        # First check Authorization header (preferred for frontend-based auth)
        header_authorization = request.headers.get("Authorization")
        if header_authorization:
            scheme, param = get_authorization_scheme_param(header_authorization)
            if scheme.lower() == "bearer":
                logger.info(f"Found bearer token in header: {param[:10]}...")
                return param

        # Try all possible cookie names for backward compatibility
        cookie_names = [self.cookie_name, "access_token_cookie", "access_token"]

        for cookie_name in cookie_names:
            cookie_authorization = request.cookies.get(cookie_name)
            if cookie_authorization:
                logger.info(f"Found authorization in cookie '{cookie_name}': {cookie_authorization[:10]}...")

                # The cookie value itself might be in the format "Bearer <token>"
                # or it might just be the token directly
                if cookie_authorization.startswith('"Bearer '):
                    # Handle the case where the cookie includes quotes and Bearer
                    # This happens when the cookie is set with the literal value "Bearer <token>"
                    token = cookie_authorization[8:-1]  # Remove '"Bearer ' prefix and '"' suffix
                    logger.info(f"Found quoted bearer token in cookie: {token[:10]}...")
                    return token

                scheme, param = get_authorization_scheme_param(cookie_authorization)
                if scheme.lower() == "bearer":
                    logger.info(f"Found bearer scheme in cookie: {param[:10]}...")
                    return param

                # If there's no scheme, treat the whole cookie as the token
                logger.info(f"Using cookie value as token: {cookie_authorization[:10]}...")
                return cookie_authorization

        # If no valid authorization found
        logger.warning("No authorization token found")
        if self.auto_error:
            raise HTTPException(
                status_code=HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return None


oauth2_scheme = OAuth2PasswordBearerWithCookieOrHeader(tokenUrl="token", auto_error=False)

app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY)


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)


def get_user(db, username: str):
    if username in db:
        user_dict = db[username]
        return UserInDB(**user_dict)


def authenticate_user(fake_db, username: str, password: str):
    user = get_user(fake_db, username)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


class NotAuthenticatedException(Exception):
    pass


def exc_handler(request, exc):
    # Return error response instead of redirect
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED, content={"status": "error", "detail": "Authentication required"}
    )


app.add_exception_handler(NotAuthenticatedException, exc_handler)


async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]):
    if not token:
        logger.warning("get_current_user called with no token")
        raise NotAuthenticatedException

    logger.info(f"Attempting to decode token: {token[:10]}...")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        logger.info(f"Token decoded successfully. Payload: {payload}")

        username: str = payload.get("sub")
        if username is None:
            logger.warning("Token payload missing 'sub' field")
            raise NotAuthenticatedException

        token_data = TokenData(username=username)
        logger.info(f"Token contains username: {username}")
    except InvalidTokenError as e:
        logger.error(f"Invalid token error: {str(e)}")
        raise NotAuthenticatedException from e

    user = get_user(fake_users_db, username=token_data.username)
    if user is None:
        logger.warning(f"User not found: {token_data.username}")
        raise NotAuthenticatedException

    logger.info(f"User authenticated successfully: {user.username}")
    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
):
    return current_user


@app.post("/token")
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
):
    user = authenticate_user(fake_users_db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": user.username}, expires_delta=access_token_expires)

    # Create a response with both token and user info
    response_data = {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"username": user.username, "email": user.email, "full_name": user.full_name},
    }

    # Set the token in a cookie for browser clients
    response = JSONResponse(content=response_data)

    # Set the cookie consistent with how the frontend expects it
    cookie_max_age = ACCESS_TOKEN_EXPIRE_MINUTES * 60
    response.set_cookie(
        key="access-token",
        value=f"Bearer {access_token}",
        max_age=cookie_max_age,
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="lax",
    )

    logger.info(f"User {user.username} logged in successfully")
    return response


@app.post("/signup")
async def signup(user_data: UserCreate):
    # Check if username already exists
    if user_data.username in fake_users_db:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered")

    # Create new user entry with hashed password
    hashed_password = get_password_hash(user_data.password)

    fake_users_db[user_data.username] = {
        "username": user_data.username,
        "email": user_data.email,
        "full_name": user_data.full_name,
        "hashed_password": hashed_password,
    }

    # Create access token for the new user
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": user_data.username}, expires_delta=access_token_expires)

    # Create a response object with token and user info
    response_data = {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"username": user_data.username, "email": user_data.email, "full_name": user_data.full_name},
    }

    # Set the token in a cookie for browser clients
    response = JSONResponse(content=response_data)

    # Set the cookie consistent with how the frontend expects it
    cookie_max_age = ACCESS_TOKEN_EXPIRE_MINUTES * 60
    response.set_cookie(
        key="access-token",
        value=f"Bearer {access_token}",
        max_age=cookie_max_age,
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="lax",
    )

    logger.info(f"User {user_data.username} signed up successfully")
    return response


@app.post("/auth/google")
async def google_auth(token_request: GoogleTokenRequest):
    """Verify Google ID token and authenticate user"""
    try:
        # Verify the Google ID token
        idinfo = id_token.verify_oauth2_token(token_request.credential, google_requests.Request(), GOOGLE_CLIENT_ID)

        # Verify the issuer
        if idinfo["iss"] not in ["accounts.google.com", "https://accounts.google.com"]:
            raise ValueError("Wrong issuer.")

        # Get user info from the token
        google_user_id = idinfo["sub"]
        email = idinfo.get("email")
        name = idinfo.get("name")
        email_verified = idinfo.get("email_verified", False)

        if not email_verified:
            raise HTTPException(status_code=400, detail="Email not verified by Google")

        # Create or get user from database
        # Use email as username for Google users
        username = email

        if username not in fake_users_db:
            # Create new user
            fake_users_db[username] = {
                "username": username,
                "full_name": name,
                "email": email,
                "hashed_password": None,  # Google users don't have passwords
                "google_user_id": google_user_id,
            }
            logger.info(f"Created new Google user: {username}")
        else:
            # Update existing user's Google ID if not set
            if "google_user_id" not in fake_users_db[username]:
                fake_users_db[username]["google_user_id"] = google_user_id
            logger.info(f"Existing Google user logged in: {username}")

        # Create access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(data={"sub": username}, expires_delta=access_token_expires)

        # Create response
        response_data = {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {"username": username, "email": email, "full_name": name},
        }

        response = JSONResponse(content=response_data)

        # Set the cookie
        cookie_max_age = ACCESS_TOKEN_EXPIRE_MINUTES * 60
        response.set_cookie(
            key="access-token",
            value=f"Bearer {access_token}",
            max_age=cookie_max_age,
            httponly=True,
            secure=False,  # Set to True in production with HTTPS
            samesite="lax",
        )

        logger.info(f"Google authentication successful for user {username}")
        return response

    except ValueError as e:
        logger.error(f"Google token verification failed: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid Google token")
    except Exception as e:
        logger.error(f"Google authentication error: {str(e)}")
        raise HTTPException(status_code=500, detail="Authentication failed")


@app.get("/login", include_in_schema=False)
async def login_status():
    """Return login status info"""
    return {"status": "unauthenticated", "message": "Authentication required"}


@app.get("/")
async def index(current_user: Annotated[User, Depends(get_current_user)]):
    # Return user information as JSON instead of templating
    return {
        "status": "authenticated",
        "user": {"username": current_user.username, "email": current_user.email, "full_name": current_user.full_name},
    }


@app.get("/logout")
async def logout():
    response = {"status": "success", "message": "Successfully logged out"}
    # Delete all possible cookie names for thorough logout
    json_response = JSONResponse(content=response)

    # Delete all possible cookie variations for complete logout
    cookie_names = ["access-token", "access_token", "access_token_cookie"]
    for cookie_name in cookie_names:
        json_response.delete_cookie(key=cookie_name)

    logger.info("User logged out, all auth cookies deleted")
    return json_response


@app.get("/all_dishes")
async def get_all_dishes(current_user: Annotated[User, Depends(get_current_user)] = None):
    # This endpoint doesn't require authentication, so we make the current_user optional
    return [recipe.model_dump() for recipe in fake_db.values()]


@app.get("/dish/{dish_id}")
async def get_dish_by_id(dish_id: str, current_user: Annotated[User, Depends(get_current_user)] = None):
    """Get a specific dish by ID"""
    # This endpoint doesn't require authentication, so we make the current_user optional
    recipe = fake_db.get(dish_id)
    if recipe:
        return recipe.model_dump()
    return None


@app.post("/add_dish_from_link")
async def add_dish_from_link(link: str, current_user: Annotated[User, Depends(get_current_user)]):
    async with aiohttp.ClientSession() as session:
        async with session.get(link) as response:
            print("Status:", response.status)
            html_page = await response.text()
    soup = BeautifulSoup(html_page, "html.parser")
    text = soup.get_text()
    text = textwrap.dedent(text)
    text = re.sub(r"\n+", "\n", text)

    class Recipe(BaseModel):
        ingredients: list[str]
        instructions: list[str]
        title: str = Field(..., description="short one liner title of the dish")
        description: str = Field(..., description="short description of the dish")
        emoji: str = Field(
            ...,
            description=(
                "emoji that best describes this dish. If you are not sure stick with "
                "raw things like fish,cheese,meat,etc, cake, pie, etc."
            ),
        )

    client = genai.Client(vertexai=True, project="personal-ai-264306", location="us-central1")
    genai_response = await client.aio.models.generate_content(
        model="gemini-2.5-flash-preview-05-20",
        contents=(
            "Given the following text from a web page, extract the exact text of the "
            "ingredients and instructions for the recipe. Use the same language as in the text."
            "Write the ingredients and instructions in the same order and exact values as they are in the text."
            "<text>" + text + "</text>"
        ),
        config={
            "response_mime_type": "application/json",
            "response_schema": Recipe,
        },
    )

    # Type assertion to fix the linter errors
    parsed_recipe = genai_response.parsed
    assert isinstance(parsed_recipe, Recipe), "Response parsing failed"

    new_recipe = RecipeModel(
        dish_id=str(uuid.uuid4())[:8],
        title=parsed_recipe.title,
        description=parsed_recipe.description,
        ingredients=parsed_recipe.ingredients,
        instructions=parsed_recipe.instructions,
        link=link,
        emoji=parsed_recipe.emoji,
    )
    fake_db[new_recipe.dish_id] = new_recipe
    return new_recipe.model_dump()


@app.put("/save_edit/{dish_id}")
async def save_edit_dish(
    dish_id: str, updated_recipe: RecipeModel, current_user: Annotated[User, Depends(get_current_user)]
):
    """Save edited recipe, overriding the old recipe with all new fields"""
    if dish_id not in fake_db:
        return None

    # Keep the original dish_id but update all other fields
    updated_recipe.dish_id = dish_id
    fake_db[dish_id] = updated_recipe
    return updated_recipe.model_dump()
