from datetime import datetime, timezone

from google.cloud import firestore
from google.cloud.firestore import AsyncClient

from app.models import RecipeMetadata, RecipeModel, User, UserInDB
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


async def get_recipes_metadata(db: AsyncClient, user: User) -> list[RecipeMetadata]:
    user_ref = db.collection("users").document(user.username)
    recipes = await user_ref.collection("recipes_metadata").get()
    return [RecipeMetadata(**i.to_dict()) for i in recipes]


async def get_recipe(db: AsyncClient, user: User, recipe_id: str) -> RecipeModel:
    user_ref = db.collection("users").document(user.username)
    snapshot = await user_ref.collection("recipes").document(recipe_id).get()
    return RecipeModel(**snapshot.to_dict())


async def insert_recipe(db: AsyncClient, user: User, recipe: RecipeModel):
    transaction = db.transaction()

    @firestore.async_transactional
    async def _insert_new_recipe(transaction, user_ref, recipe: RecipeModel, metadata: RecipeMetadata):
        transaction.set(user_ref.collection("recipes").document(recipe.dish_id), recipe.model_dump())
        transaction.set(
            user_ref.collection("recipes_metadata").document(recipe.dish_id),
            metadata.model_dump(),
        )

    metadata = RecipeMetadata(
        dish_id=recipe.dish_id,
        title=recipe.title,
        description=recipe.description,
        emoji=recipe.emoji,
        date_added=datetime.now(timezone.utc),
    )

    user_ref = db.collection("users").document(user.username)
    await _insert_new_recipe(transaction, user_ref, recipe, metadata)


async def update_recipe(db: AsyncClient, user: User, recipe: RecipeModel):
    transaction = db.transaction()

    @firestore.async_transactional
    async def _update_recipe(transaction, user_ref, recipe: RecipeModel, metadata: RecipeMetadata):
        transaction.set(user_ref.collection("recipes").document(recipe.dish_id), recipe.model_dump(exclude_none=True))
        transaction.set(
            user_ref.collection("recipes_metadata").document(recipe.dish_id),
            metadata.model_dump(exclude_none=True),
            merge=True,
        )

    metadata = RecipeMetadata(
        dish_id=recipe.dish_id,
        title=recipe.title,
        description=recipe.description,
        emoji=recipe.emoji,
    )
    user_ref = db.collection("users").document(user.username)
    await _update_recipe(transaction, user_ref, recipe, metadata)
