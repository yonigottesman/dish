import uuid
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.config import settings
from app.crud import authenticate_user, get_user, insert_user
from app.dependencies import CurrentUser, LoggerDep, SessionDep
from app.models import GoogleTokenRequest, UserCreateRequest, UserInDB
from app.security import create_access_token, get_password_hash

router = APIRouter(
    tags=["login"],
)


@router.post("/token")
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: SessionDep,
    logger: LoggerDep,
):
    user = await authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
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
    cookie_max_age = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60

    response.set_cookie(
        key="access-token",
        value=f"Bearer {access_token}",
        max_age=cookie_max_age,
        httponly=True,
        secure=settings.IS_PRODUCTION,  # Use secure cookies in production (HTTPS)
        samesite="none" if settings.IS_PRODUCTION else "lax",  # Allow cross-origin in production
        domain=None,  # Let browser determine domain
    )

    logger.info(f"User {user.username} logged in successfully")
    return response


@router.post("/signup")
async def signup(user_data: UserCreateRequest, db: SessionDep, logger: LoggerDep):
    # Check if username already exists
    if await get_user(db, user_data.username):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered")

    # Create new user entry with hashed password
    hashed_password = get_password_hash(user_data.password)

    user = UserInDB(
        user_id=str(uuid.uuid4())[:8],
        username=user_data.username,
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=hashed_password,
    )
    result = await insert_user(db, user)
    if not result:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered")

    # Create access token for the new user
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
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
    cookie_max_age = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60

    response.set_cookie(
        key="access-token",
        value=f"Bearer {access_token}",
        max_age=cookie_max_age,
        httponly=True,
        secure=settings.IS_PRODUCTION,  # Use secure cookies in production (HTTPS)
        samesite="none" if settings.IS_PRODUCTION else "lax",  # Allow cross-origin in production
        domain=None,  # Let browser determine domain
    )

    logger.info(f"User {user_data.username} signed up successfully")
    return response


@router.post("/auth/google")
async def google_auth(token_request: GoogleTokenRequest, db: SessionDep, logger: LoggerDep):
    """Verify Google ID token and authenticate user"""
    try:
        # Verify the Google ID token
        idinfo = id_token.verify_oauth2_token(
            token_request.credential, google_requests.Request(), settings.GOOGLE_CLIENT_ID
        )

        # Verify the issuer
        if idinfo["iss"] not in ["accounts.google.com", "https://accounts.google.com"]:
            raise ValueError("Wrong issuer.")

        # Get user info from the token
        email = idinfo.get("email")
        name = idinfo.get("name")
        email_verified = idinfo.get("email_verified", False)

        if not email_verified:
            raise HTTPException(status_code=400, detail="Email not verified by Google")

        # Create or get user from database
        # Use email as username for Google users
        username = email

        if not await get_user(db, username):
            user = UserInDB(
                user_id=str(uuid.uuid4())[:8],
                username=username,
                email=email,
                full_name=name,
                hashed_password=None,
            )
            await insert_user(db, user)
            logger.info(f"Created new Google user: {username}")
        else:
            logger.info(f"Existing Google user logged in: {username}")

        # Create access token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(data={"sub": username}, expires_delta=access_token_expires)

        # Create response
        response_data = {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {"username": username, "email": email, "full_name": name},
        }

        response = JSONResponse(content=response_data)

        # Set the cookie
        cookie_max_age = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60

        response.set_cookie(
            key="access-token",
            value=f"Bearer {access_token}",
            max_age=cookie_max_age,
            httponly=True,
            secure=settings.IS_PRODUCTION,  # Use secure cookies in production (HTTPS)
            samesite="none" if settings.IS_PRODUCTION else "lax",  # Allow cross-origin in production
            domain=None,  # Let browser determine domain
        )

        logger.info(f"Google authentication successful for user {username}")
        return response

    except ValueError as e:
        logger.error(f"Google token verification failed: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid Google token")
    except Exception as e:
        logger.error(f"Google authentication error: {str(e)}")
        raise HTTPException(status_code=500, detail="Authentication failed")


@router.get("/login", include_in_schema=False)
async def login_status():
    """Return login status info"""
    return {"status": "unauthenticated", "message": "Authentication required"}


@router.get("/")
async def index(current_user: CurrentUser):
    # Return user information as JSON instead of templating
    return {
        "status": "authenticated",
        "user": {"username": current_user.username, "email": current_user.email, "full_name": current_user.full_name},
    }


@router.get("/logout")
async def logout(logger: LoggerDep):
    response = {"status": "success", "message": "Successfully logged out"}
    # Delete all possible cookie names for thorough logout
    json_response = JSONResponse(content=response)

    # Log production status for debugging
    logger.info(f"Logout: IS_PRODUCTION={settings.IS_PRODUCTION}")

    # Delete all possible cookie variations for complete logout
    # Important: Use the same attributes that were used when setting the cookies
    cookie_names = ["access-token", "access_token", "access_token_cookie"]

    for cookie_name in cookie_names:
        # Try deleting with production settings (secure=True, samesite="none")
        json_response.delete_cookie(
            key=cookie_name,
            secure=True,
            samesite="none",
            domain=None,
        )
        # Also try deleting with development settings (secure=False, samesite="lax")
        json_response.delete_cookie(
            key=cookie_name,
            secure=False,
            samesite="lax",
            domain=None,
        )
        # Also try deleting with minimal attributes (for backward compatibility)
        json_response.delete_cookie(key=cookie_name)

    logger.info("User logged out, all auth cookies deleted with multiple attribute combinations")
    return json_response
