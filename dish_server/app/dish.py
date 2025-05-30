import re
import textwrap
import uuid
from typing import Dict

import aiohttp
from bs4 import BeautifulSoup
from fastapi import APIRouter
from google import genai
from pydantic import BaseModel, Field

from app.dependencies import CurrentUser
from app.login import router as login_router
from app.models import RecipeModel

router = APIRouter(
    tags=["dish"],
)

# Recipe data structure
fake_db: Dict[str, RecipeModel] = {}


@router.get("/all_dishes")
async def get_all_dishes(current_user: CurrentUser):
    # This endpoint doesn't require authentication, so we make the current_user optional
    return [recipe.model_dump() for recipe in fake_db.values()]


@router.get("/dish/{dish_id}")
async def get_dish_by_id(dish_id: str, current_user: CurrentUser):
    """Get a specific dish by ID"""
    # This endpoint doesn't require authentication, so we make the current_user optional
    recipe = fake_db.get(dish_id)
    if recipe:
        return recipe.model_dump()
    return None


@router.post("/add_dish_from_link")
async def add_dish_from_link(link: str, current_user: CurrentUser):
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


@router.put("/save_edit/{dish_id}")
async def save_edit_dish(dish_id: str, updated_recipe: RecipeModel, current_user: CurrentUser):
    """Save edited recipe, overriding the old recipe with all new fields"""
    if dish_id not in fake_db:
        return None

    # Keep the original dish_id but update all other fields
    updated_recipe.dish_id = dish_id
    fake_db[dish_id] = updated_recipe
    return updated_recipe.model_dump()
