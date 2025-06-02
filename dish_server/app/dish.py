import io
import re
import textwrap
import uuid

import aiohttp
from bs4 import BeautifulSoup
from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile
from google.cloud import documentai_v1, storage
from google.genai import types
from langdetect import detect
from PIL import Image, ImageDraw
from pillow_heif import register_heif_opener
from pydantic import BaseModel, Field

from app.config import settings
from app.crud import get_recipe, get_recipes_metadata, insert_recipe, update_recipe
from app.dependencies import (
    CurrentUser,
    DocumentaiClientDep,
    DocumentaiProcessorDep,
    GenaiClientDep,
    LoggerDep,
    SessionDep,
    StorageClientDep,
)
from app.models import RecipeModel, User

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


class RecipeForLLM(BaseModel):
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


def detect_language(recipe: RecipeForLLM) -> str:
    text = "\n".join(recipe.ingredients + recipe.instructions) + " " + recipe.title + " " + recipe.description
    try:
        return detect(text)
    except Exception:
        return "en"


@router.post("/add_dish_from_link")
async def add_dish_from_link(
    link: str,
    current_user: CurrentUser,
    db: SessionDep,
    genai_client: GenaiClientDep,
):
    async with aiohttp.ClientSession() as session:
        async with session.get(link) as response:
            html_page = await response.text()
    soup = BeautifulSoup(html_page, "html.parser")
    text = soup.get_text()
    text = textwrap.dedent(text)
    text = re.sub(r"\n+", "\n", text)

    genai_response = await genai_client.aio.models.generate_content(
        model="gemini-2.5-flash-preview-05-20",
        contents=(
            "Given the following text from a web page, extract the exact text of the "
            "ingredients and instructions for the recipe. Use the same language as in the text."
            "Write the ingredients and instructions in the same order and exact values as they are in the text."
            "<text>" + text + "</text>"
        ),
        config={
            "response_mime_type": "application/json",
            "response_schema": RecipeForLLM,
        },
    )

    # Type assertion to fix the linter errors
    parsed_recipe = genai_response.parsed
    assert isinstance(parsed_recipe, RecipeForLLM), "Response parsing failed"

    new_recipe = RecipeModel(
        dish_id=str(uuid.uuid4()),
        title=parsed_recipe.title,
        description=parsed_recipe.description,
        ingredients=parsed_recipe.ingredients,
        instructions=parsed_recipe.instructions,
        link=link,
        emoji=parsed_recipe.emoji,
        language=detect_language(parsed_recipe),
    )
    await insert_recipe(db, current_user, new_recipe)
    return new_recipe.model_dump()


@router.post("/add_dish_from_text")
async def add_dish_from_text(
    text: str,
    current_user: CurrentUser,
    db: SessionDep,
    genai_client: GenaiClientDep,
):
    genai_response = await genai_client.aio.models.generate_content(
        model="gemini-2.5-flash-preview-05-20",
        contents=(
            "Given the following text, extract the exact text of the "
            "ingredients and instructions for the recipe. Use the same language as in the text."
            "Write the ingredients and instructions in the same order and exact values as they are in the text."
            "<text>" + text + "</text>"
        ),
        config={
            "response_mime_type": "application/json",
            "response_schema": RecipeForLLM,
        },
    )
    parsed_recipe = genai_response.parsed
    assert isinstance(parsed_recipe, RecipeForLLM), "Response parsing failed"
    new_recipe = RecipeModel(
        dish_id=str(uuid.uuid4()),
        title=parsed_recipe.title,
        description=parsed_recipe.description,
        ingredients=parsed_recipe.ingredients,
        instructions=parsed_recipe.instructions,
        link=None,
        emoji=parsed_recipe.emoji,
        language=detect_language(parsed_recipe),
    )
    await insert_recipe(db, current_user, new_recipe)
    return new_recipe.model_dump()


def upload_image_to_gcs(image_bytes: bytes, image_id: str, user: User, storage_client: storage.Client):
    blob_path = f"{user.user_id}/{image_id}"
    blob = storage_client.bucket(settings.GCS_BUCKET_NAME).blob(blob_path)
    blob.upload_from_string(image_bytes, content_type="image/jpeg")


def delete_image_from_gcs(image_id: str, user: User, storage_client: storage.Client):
    blob_path = f"{user.user_id}/{image_id}"
    blob = storage_client.bucket(settings.GCS_BUCKET_NAME).blob(blob_path)
    blob.delete()


@router.post("/add_dish_from_image")
async def add_dish_from_image(
    current_user: CurrentUser,
    db: SessionDep,
    documentai_processor: DocumentaiProcessorDep,
    documentai_client: DocumentaiClientDep,
    logger: LoggerDep,
    genai_client: GenaiClientDep,
    storage_client: StorageClientDep,
    image: UploadFile = File(...),
):
    image_bytes = await image.read()
    pil_image = Image.open(io.BytesIO(image_bytes))
    jpeg_image = pil_image.convert("RGB")
    jpeg_buffer = io.BytesIO()
    jpeg_image.save(jpeg_buffer, format="JPEG")
    jpeg_bytes = jpeg_buffer.getvalue()

    logger.info("uploaded image")
    raw_document = documentai_v1.RawDocument(
        content=jpeg_bytes,
        mime_type="image/jpeg",
    )

    # Send a request and get the processed document.
    request = documentai_v1.ProcessRequest(name=documentai_processor.name, raw_document=raw_document)
    result: documentai_v1.ProcessResponse = await documentai_client.process_document(request=request)
    document = result.document
    logger.info("ocr on document")

    draw = ImageDraw.Draw(jpeg_image)
    for block in document.pages[0].blocks:
        layout = block.layout
        vertices = layout.bounding_poly.vertices
        polygon_points = [(vertex.x, vertex.y) for vertex in vertices]
        draw.polygon(polygon_points, outline="red", width=3)

    max_width = 1024
    max_height = 1024
    width, height = jpeg_image.size

    if width > max_width or height > max_height:
        scale_factor = min(max_width / width, max_height / height)
        new_width = int(width * scale_factor)
        new_height = int(height * scale_factor)
        image_resized = jpeg_image.resize((new_width, new_height), Image.Resampling.LANCZOS)
        logger.info(f"Image resized from {width}x{height} to {new_width}x{new_height}")
    else:
        image_resized = jpeg_image
        logger.info(f"Image size {width}x{height} is within limits, no resizing needed")

    output_buffer = io.BytesIO()
    image_resized.save(output_buffer, format="JPEG")
    image_bytes = output_buffer.getvalue()

    genai_response = await genai_client.aio.models.generate_content(
        model="gemini-2.5-flash-preview-05-20",
        contents=[
            (
                "Given the following text and image, extract the exact text of the "
                "ingredients and instructions for the recipe. Use the same language as in the text. "
                "Write the ingredients and instructions in the same order and exact values "
                "as they are in the text and image. "
                "<text>" + document.text + "</text>"
            ),
            types.Part.from_bytes(
                data=image_bytes,
                mime_type="image/jpeg",
            ),
        ],  # type: ignore
        config={
            "response_mime_type": "application/json",
            "response_schema": RecipeForLLM,
        },
    )

    parsed_recipe = genai_response.parsed
    assert isinstance(parsed_recipe, RecipeForLLM), "Response parsing failed"

    dish_id = str(uuid.uuid4())
    image_id = f"{str(uuid.uuid4())}.jpeg"
    upload_image_to_gcs(jpeg_bytes, image_id, current_user, storage_client)

    new_recipe = RecipeModel(
        dish_id=dish_id,
        title=parsed_recipe.title,
        description=parsed_recipe.description,
        ingredients=parsed_recipe.ingredients,
        instructions=parsed_recipe.instructions,
        link=None,
        emoji=parsed_recipe.emoji,
        image_ids=[image_id],
        language=detect_language(parsed_recipe),
    )
    await insert_recipe(db, current_user, new_recipe)
    return new_recipe.model_dump()


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
            # Convert to JPEG if needed
            pil_image = Image.open(io.BytesIO(image_bytes))
            jpeg_image = pil_image.convert("RGB")
            jpeg_buffer = io.BytesIO()
            jpeg_image.save(jpeg_buffer, format="JPEG")
            jpeg_bytes = jpeg_buffer.getvalue()

            # Upload to GCS
            image_id = f"{str(uuid.uuid4())}.jpeg"
            upload_image_to_gcs(jpeg_bytes, image_id, current_user, storage_client)
            new_image_ids.append(image_id)

        # Add new image IDs to the existing ones
        existing_image_ids = updated_recipe_model.image_ids or []
        updated_recipe_model.image_ids = existing_image_ids + new_image_ids

    await update_recipe(db, current_user, updated_recipe_model)
    return updated_recipe_model.model_dump()
