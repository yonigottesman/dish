from datetime import datetime, timezone

from google.cloud import firestore
from google.cloud.firestore import AsyncClient

from app.models import DishStatus, RecipeMetadata, RecipeModel, SharedRecipeRef, User, UserInDB
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
    recipes = await user_ref.collection("recipes_metadata").order_by(
        "date_added", direction=firestore.Query.DESCENDING
    ).get()
    return [RecipeMetadata(**i.to_dict()) for i in recipes]


async def get_recipe(db: AsyncClient, user: User, recipe_id: str) -> RecipeModel:
    user_ref = db.collection("users").document(user.username)
    snapshot = await user_ref.collection("recipes").document(recipe_id).get()
    return RecipeModel(**snapshot.to_dict())


async def insert_recipe(db: AsyncClient, user: User, recipe: RecipeModel):
    transaction = db.transaction()

    @firestore.async_transactional
    async def _insert_new_recipe(transaction, user_ref, recipe: RecipeModel, metadata: RecipeMetadata):
        transaction.set(user_ref.collection("recipes").document(recipe.dish_id), recipe.model_dump(mode="json"))
        transaction.set(
            user_ref.collection("recipes_metadata").document(recipe.dish_id),
            metadata.model_dump(mode="json"),
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
        transaction.set(user_ref.collection("recipes").document(recipe.dish_id), recipe.model_dump(mode="json", exclude_none=True))
        transaction.set(
            user_ref.collection("recipes_metadata").document(recipe.dish_id),
            metadata.model_dump(mode="json", exclude_none=True),
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


async def delete_recipe(db: AsyncClient, user: User, recipe_id: str):
    transaction = db.transaction()

    @firestore.async_transactional
    async def _delete_recipe(transaction, user_ref, recipe_id: str):
        # Delete the recipe document
        transaction.delete(user_ref.collection("recipes").document(recipe_id))
        # Delete the recipe metadata document
        transaction.delete(user_ref.collection("recipes_metadata").document(recipe_id))

    user_ref = db.collection("users").document(user.username)
    await _delete_recipe(transaction, user_ref, recipe_id)


async def insert_placeholder_recipe(
    db: AsyncClient,
    user: User,
    dish_id: str,
    link: str | None = None,
) -> RecipeModel:
    """Insert a placeholder recipe with status='processing'"""
    transaction = db.transaction()

    placeholder = RecipeModel(
        dish_id=dish_id,
        title="Processing...",
        description="Your recipe is being processed",
        ingredients=[],
        instructions=[],
        link=link,
        emoji=None,
        language="en",
        status=DishStatus.PROCESSING,
    )

    metadata = RecipeMetadata(
        dish_id=dish_id,
        title="Processing...",
        description="Your recipe is being processed",
        emoji=None,
        date_added=datetime.now(timezone.utc),
        status=DishStatus.PROCESSING,
    )

    @firestore.async_transactional
    async def _insert_placeholder(transaction, user_ref, recipe: RecipeModel, meta: RecipeMetadata):
        transaction.set(user_ref.collection("recipes").document(recipe.dish_id), recipe.model_dump(mode="json"))
        transaction.set(user_ref.collection("recipes_metadata").document(recipe.dish_id), meta.model_dump(mode="json"))

    user_ref = db.collection("users").document(user.username)
    await _insert_placeholder(transaction, user_ref, placeholder, metadata)
    return placeholder


async def update_recipe_from_processing(db: AsyncClient, username: str, recipe: RecipeModel):
    """Update a placeholder recipe with actual content after processing"""
    transaction = db.transaction()

    recipe.status = DishStatus.COMPLETED

    metadata = RecipeMetadata(
        dish_id=recipe.dish_id,
        title=recipe.title,
        description=recipe.description,
        emoji=recipe.emoji,
        status=DishStatus.COMPLETED,
    )

    @firestore.async_transactional
    async def _update(transaction, user_ref, recipe: RecipeModel, metadata: RecipeMetadata):
        transaction.set(user_ref.collection("recipes").document(recipe.dish_id), recipe.model_dump(mode="json"))
        transaction.set(
            user_ref.collection("recipes_metadata").document(recipe.dish_id),
            metadata.model_dump(mode="json", exclude_none=True),  # exclude_none to preserve date_added
            merge=True,
        )

    user_ref = db.collection("users").document(username)
    await _update(transaction, user_ref, recipe, metadata)


async def mark_recipe_failed(db: AsyncClient, username: str, dish_id: str, error_message: str):
    """Mark a recipe as failed with an error message"""
    user_ref = db.collection("users").document(username)

    await user_ref.collection("recipes").document(dish_id).update({
        "status": DishStatus.FAILED.value,
        "error_message": error_message[:500],
        "title": "Processing Failed",
        "description": error_message[:200],
    })

    await user_ref.collection("recipes_metadata").document(dish_id).update({
        "status": DishStatus.FAILED.value,
        "title": "Processing Failed",
        "description": error_message[:200],
    })


async def create_shared_recipe_ref(db: AsyncClient, user: User, dish_id: str) -> tuple[SharedRecipeRef, bool]:
    """Create a reference in the shared collection for public access.
    Returns (shared_ref, created) where created is False if already shared."""
    # Check if already shared
    existing = await db.collection("shared").document(dish_id).get()
    if existing.exists:
        return SharedRecipeRef(**existing.to_dict()), False

    # Verify the recipe exists
    user_ref = db.collection("users").document(user.username)
    snapshot = await user_ref.collection("recipes").document(dish_id).get()
    if not snapshot.exists:
        raise ValueError("Recipe not found")

    shared_ref = SharedRecipeRef(
        dish_id=dish_id,
        owner_username=user.username,
        shared_at=datetime.now(timezone.utc),
    )

    # Save reference to the shared collection
    await db.collection("shared").document(dish_id).set(shared_ref.model_dump(mode="json"))
    return shared_ref, True


async def get_shared_recipe_ref(db: AsyncClient, dish_id: str) -> SharedRecipeRef | None:
    """Get a shared recipe reference by dish_id (no auth required)"""
    snapshot = await db.collection("shared").document(dish_id).get()
    if snapshot.exists:
        return SharedRecipeRef(**snapshot.to_dict())
    return None


async def get_recipe_by_username(db: AsyncClient, username: str, recipe_id: str) -> RecipeModel | None:
    """Get a recipe by username and recipe_id (for shared access)"""
    user_ref = db.collection("users").document(username)
    snapshot = await user_ref.collection("recipes").document(recipe_id).get()
    if snapshot.exists:
        return RecipeModel(**snapshot.to_dict())
    return None
