import re
import textwrap
import uuid

import aiohttp
from bs4 import BeautifulSoup
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.crud import get_recipe, get_recipes, insert_recipe, update_recipe
from app.dependencies import CurrentUser, GenaiClientDep, SessionDep
from app.models import RecipeModel

router = APIRouter(
    tags=["dish"],
)


@router.get("/all_dishes")
async def get_all_dishes(current_user: CurrentUser, db: SessionDep):
    recipes = await get_recipes(db, current_user)
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
        dish_id=str(uuid.uuid4())[:8],
        title=parsed_recipe.title,
        description=parsed_recipe.description,
        ingredients=parsed_recipe.ingredients,
        instructions=parsed_recipe.instructions,
        link=link,
        emoji=parsed_recipe.emoji,
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
        dish_id=str(uuid.uuid4())[:8],
        title=parsed_recipe.title,
        description=parsed_recipe.description,
        ingredients=parsed_recipe.ingredients,
        instructions=parsed_recipe.instructions,
        link=None,
        emoji=parsed_recipe.emoji,
    )
    await insert_recipe(db, current_user, new_recipe)
    return new_recipe.model_dump()


@router.put("/save_edit/{dish_id}")
async def save_edit_dish(dish_id: str, updated_recipe: RecipeModel, current_user: CurrentUser, db: SessionDep):
    """Save edited recipe, overriding the old recipe with all new fields"""
    assert updated_recipe.dish_id == dish_id, "Dish ID mismatch"
    await update_recipe(db, current_user, updated_recipe)
    return updated_recipe.model_dump()
