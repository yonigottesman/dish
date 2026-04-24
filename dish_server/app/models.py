from datetime import datetime
from enum import Enum

from pydantic import BaseModel


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: str | None = None


class User(BaseModel):
    user_id: str
    username: str
    email: str | None = None
    full_name: str | None = None


class UserInDB(User):
    hashed_password: str | None = None


class UserCreateRequest(BaseModel):
    username: str
    password: str
    email: str | None = None
    full_name: str | None = None


class GoogleTokenRequest(BaseModel):
    credential: str


class DishImportType(Enum):
    TEXT = "text"
    IMAGE = "image"
    LINK = "link"


class DishStatus(Enum):
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class RecipeModel(BaseModel):
    dish_id: str
    title: str
    description: str
    ingredients: list[str]
    instructions: list[str]
    image_ids: list[str] | None = None
    link: str | None = None
    emoji: str | None = None
    language: str = "en"
    notes: str | None = None
    status: DishStatus | None = None
    error_message: str | None = None


class RecipeMetadata(BaseModel):
    dish_id: str
    title: str
    description: str
    emoji: str | None = None
    date_added: datetime | None = None
    status: DishStatus | None = None


class PubSubMessage(BaseModel):
    dish_id: str
    import_type: DishImportType
    username: str
    text_data: str | None = None
    image_data_gcs_path: str | None = None
    link_data_url: str | None = None


class SharedRecipeRef(BaseModel):
    """Reference to a shared recipe - stores only the pointer, not the full recipe"""
    dish_id: str
    owner_username: str
    shared_at: datetime
