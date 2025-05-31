from google.cloud import firestore
from google.cloud.firestore import AsyncClient

from app.models import RecipeModel, User, UserInDB
from app.security import verify_password


async def get_user(db: AsyncClient, username: str):
    snapshot = await db.collection("users").document(username).get()
    if snapshot.exists:
        return UserInDB(**snapshot.to_dict())
    return None


async def insert_user(db: AsyncClient, user: UserInDB):
    transaction = db.transaction()

    @firestore.async_transactional
    async def _insert_new_user(transaction, user_ref, user: UserInDB):
        snapshot = await user_ref.get(transaction=transaction)
        if not snapshot.exists:
            transaction.set(user_ref, user.model_dump())
            return True
        else:
            return False

    user_ref = db.collection("users").document(user.username)
    result = await _insert_new_user(transaction, user_ref, user)
    return result


async def authenticate_user(db, username: str, password: str):
    user = await get_user(db, username)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user


async def get_recipes(db: AsyncClient, user: User) -> list[RecipeModel]:
    user_ref = db.collection("users").document(user.username)
    recipes = await user_ref.collection("recipes").get()
    return [RecipeModel(**i.to_dict()) for i in recipes]


async def get_recipe(db: AsyncClient, user: User, recipe_id: str) -> RecipeModel:
    user_ref = db.collection("users").document(user.username)
    snapshot = await user_ref.collection("recipes").document(recipe_id).get()
    return RecipeModel(**snapshot.to_dict())


async def insert_recipe(db: AsyncClient, user: User, recipe: RecipeModel):
    user_ref = db.collection("users").document(user.username)
    await user_ref.collection("recipes").document(recipe.dish_id).set(recipe.model_dump())


async def update_recipe(db: AsyncClient, user: User, recipe: RecipeModel):
    user_ref = db.collection("users").document(user.username)
    await user_ref.collection("recipes").document(recipe.dish_id).set(recipe.model_dump(), merge=False)
