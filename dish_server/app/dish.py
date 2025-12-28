import io
import logging
import uuid

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile
from google.cloud import storage
from PIL import Image, ImageOps
from pillow_heif import register_heif_opener

from app.config import settings
from app.crud import delete_recipe as crud_delete_recipe
from app.crud import get_recipe, get_recipes_metadata, insert_placeholder_recipe, update_recipe
from app.dependencies import (
    CurrentUser,
    LoggerDep,
    PubSubPublisherDep,
    SessionDep,
    StorageClientDep,
)
from app.models import DishImportType, PubSubMessage, RecipeModel, User

router = APIRouter(
    tags=["dish"],
)
register_heif_opener()


@router.get("/all_dishes")
async def get_all_dishes(current_user: CurrentUser, db: SessionDep):
    recipes = await get_recipes_metadata(db, current_user)
    return [recipe.model_dump() for recipe in recipes]


@router.get("/dish/{dish_id}")
async def get_dish_by_id(dish_id: str, current_user: CurrentUser, db: SessionDep):
    """Get a specific dish by ID"""
    recipe = await get_recipe(db, current_user, dish_id)
    if recipe:
        return recipe.model_dump()
    raise HTTPException(status_code=404, detail="Recipe not found")


@router.post("/add_dish_from_link")
async def add_dish_from_link(
    link: str,
    current_user: CurrentUser,
    db: SessionDep,
    pubsub_publisher: PubSubPublisherDep,
    logger: LoggerDep,
):
    # Generate dish_id
    dish_id = str(uuid.uuid4())

    # Create placeholder in Firestore
    placeholder = await insert_placeholder_recipe(db, current_user, dish_id, link=link)

    # Publish job to Pub/Sub
    job = PubSubMessage(
        dish_id=dish_id,
        import_type=DishImportType.LINK,
        username=current_user.username,
        link_data_url=link,
    )
    publish_dish_job(job, pubsub_publisher, logger)

    # Return placeholder immediately
    return placeholder.model_dump()


def publish_dish_job(job_data: PubSubMessage, pubsub_publisher: PubSubPublisherDep, logger: logging.Logger):
    logger.info("about to publish job: %s.", job_data.dish_id)
    future = pubsub_publisher.publish(
        pubsub_publisher.topic_path(settings.GOOGLE_CLOUD_PROJECT, settings.DISH_JOBS_TOPIC_ID),
        job_data.model_dump_json().encode("utf-8"),
    )
    message_id = future.result()
    logger.info("Published job: %s.", message_id)


@router.post("/add_dish_from_text")
async def add_dish_from_text(
    text: str,
    current_user: CurrentUser,
    db: SessionDep,
    pubsub_publisher: PubSubPublisherDep,
    logger: LoggerDep,
):
    # Generate dish_id
    dish_id = str(uuid.uuid4())

    # Create placeholder in Firestore
    placeholder = await insert_placeholder_recipe(db, current_user, dish_id)

    # Publish job to Pub/Sub
    job = PubSubMessage(
        dish_id=dish_id,
        import_type=DishImportType.TEXT,
        username=current_user.username,
        text_data=text,
    )
    publish_dish_job(job, pubsub_publisher, logger)

    # Return placeholder immediately
    return placeholder.model_dump()


def process_image_bytes(image_bytes: bytes) -> bytes:
    pil_image = Image.open(io.BytesIO(image_bytes))
    pil_image = ImageOps.exif_transpose(pil_image)
    pil_image = pil_image.convert("RGB")
    jpeg_buffer = io.BytesIO()
    pil_image.save(jpeg_buffer, format="JPEG", quality=85)
    return jpeg_buffer.getvalue()


def upload_image_to_gcs(image_bytes: bytes, image_id: str, user: User, storage_client: storage.Client):
    blob_path = f"{user.user_id}/{image_id}"
    blob = storage_client.bucket(settings.GCS_BUCKET_NAME).blob(blob_path)
    blob.upload_from_string(image_bytes, content_type="image/jpeg")


def upload_pending_image_to_gcs(image_bytes: bytes, dish_id: str, user: User, storage_client: storage.Client) -> str:
    """Upload image to GCS for async processing, returns GCS path"""
    blob_path = f"{user.user_id}/pending/{dish_id}.jpeg"
    blob = storage_client.bucket(settings.GCS_BUCKET_NAME).blob(blob_path)
    blob.upload_from_string(image_bytes, content_type="image/jpeg")
    return blob_path


def delete_image_from_gcs(image_id: str, user: User, storage_client: storage.Client):
    blob_path = f"{user.user_id}/{image_id}"
    blob = storage_client.bucket(settings.GCS_BUCKET_NAME).blob(blob_path)
    blob.delete()


@router.post("/add_dish_from_image")
async def add_dish_from_image(
    current_user: CurrentUser,
    db: SessionDep,
    logger: LoggerDep,
    storage_client: StorageClientDep,
    pubsub_publisher: PubSubPublisherDep,
    image: UploadFile = File(...),
):
    # Generate dish_id
    dish_id = str(uuid.uuid4())

    image_bytes = await image.read()
    jpeg_bytes = process_image_bytes(image_bytes)

    # Upload to GCS pending location
    gcs_path = upload_pending_image_to_gcs(jpeg_bytes, dish_id, current_user, storage_client)
    logger.info("Uploaded pending image to %s", gcs_path)

    # Create placeholder in Firestore
    placeholder = await insert_placeholder_recipe(db, current_user, dish_id)

    # Publish job to Pub/Sub
    job = PubSubMessage(
        dish_id=dish_id,
        import_type=DishImportType.IMAGE,
        username=current_user.username,
        image_data_gcs_path=gcs_path,
    )
    publish_dish_job(job, pubsub_publisher, logger)

    # Return placeholder immediately
    return placeholder.model_dump()


@router.get("/image/{image_id}")
async def get_image(
    image_id: str,
    storage_client: StorageClientDep,
    user: CurrentUser,
    logger: LoggerDep,
):
    blob_path = f"{user.user_id}/{image_id}"
    blob = storage_client.bucket(settings.GCS_BUCKET_NAME).blob(blob_path)
    return Response(content=blob.download_as_bytes(), media_type="image/jpeg")


@router.put("/delete/{dish_id}")
async def delete_recipe(
    dish_id: str,
    current_user: CurrentUser,
    db: SessionDep,
    storage_client: StorageClientDep,
):
    # Get the recipe to access its image_ids
    recipe = await get_recipe(db, current_user, dish_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    # Delete all associated images from GCS
    if recipe.image_ids:
        for image_id in recipe.image_ids:
            try:
                delete_image_from_gcs(image_id, current_user, storage_client)
            except Exception:
                # Continue deleting other images even if one fails
                pass

    # Delete the recipe and metadata from the database
    await crud_delete_recipe(db, current_user, dish_id)

    return {"message": "Recipe deleted successfully"}


@router.put("/save_edit/{dish_id}")
async def save_edit_dish(
    dish_id: str,
    current_user: CurrentUser,
    db: SessionDep,
    storage_client: StorageClientDep,
    updated_recipe: str = Form(...),
    original_recipe: str = Form(...),
    images: list[UploadFile] | None = File(None),
):
    """Save edited recipe, overriding the old recipe with all new fields"""
    updated_recipe_model = RecipeModel.model_validate_json(updated_recipe)
    original_recipe_model = RecipeModel.model_validate_json(original_recipe)
    assert updated_recipe_model.dish_id == dish_id, "Dish ID mismatch"

    # Find images that need to be deleted (in original but not in updated)
    original_image_ids = set(original_recipe_model.image_ids or [])
    updated_image_ids = set(updated_recipe_model.image_ids or [])
    images_to_delete = original_image_ids - updated_image_ids

    # Delete removed images from GCS
    for image_id in images_to_delete:
        delete_image_from_gcs(image_id, current_user, storage_client)

    # Process new images if any were uploaded
    if images:
        new_image_ids = []
        for image in images:
            image_bytes = await image.read()
            jpeg_bytes = process_image_bytes(image_bytes)

            # Upload to GCS
            image_id = f"{str(uuid.uuid4())}.jpeg"
            upload_image_to_gcs(jpeg_bytes, image_id, current_user, storage_client)
            new_image_ids.append(image_id)

        # Add new image IDs to the existing ones
        existing_image_ids = updated_recipe_model.image_ids or []
        updated_recipe_model.image_ids = existing_image_ids + new_image_ids

    await update_recipe(db, current_user, updated_recipe_model)
    return updated_recipe_model.model_dump()
