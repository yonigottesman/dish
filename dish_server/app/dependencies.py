import logging
from typing import Annotated, Generator, Optional

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordBearer
from fastapi.security.utils import get_authorization_scheme_param
from jwt.exceptions import InvalidTokenError
from starlette.status import HTTP_401_UNAUTHORIZED

from app.config import settings
from app.crud import get_user
from app.models import TokenData, User

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


fake_users_db = {
    "johndoe": {
        "username": "johndoe",
        "full_name": "John Doe",
        "email": "johndoe@example.com",
        "hashed_password": "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW",
    }
}


def get_db() -> Generator[dict, None, None]:
    yield fake_users_db


SessionDep = Annotated[dict, Depends(get_db)]


class NotAuthenticatedException(Exception):
    pass


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
TokenDep = Annotated[str, Depends(oauth2_scheme)]


async def get_current_user(token: TokenDep, db: SessionDep):
    if not token:
        logger.warning("get_current_user called with no token")
        raise NotAuthenticatedException

    logger.info(f"Attempting to decode token: {token[:10]}...")
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
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

    user = get_user(db, username=token_data.username)
    if user is None:
        logger.warning(f"User not found: {token_data.username}")
        raise NotAuthenticatedException

    logger.info(f"User authenticated successfully: {user.username}")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_current_active_user(current_user: CurrentUser):
    return current_user
