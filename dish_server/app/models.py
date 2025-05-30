from pydantic import BaseModel


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


class RecipeModel(BaseModel):
    dish_id: str
    title: str
    description: str
    ingredients: list[str]
    instructions: list[str]
    link: str | None = None
    emoji: str | None = None
