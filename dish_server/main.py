import logging
import re
import textwrap
import uuid
from typing import Dict, List

import aiohttp
from bs4 import BeautifulSoup
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from pydantic import BaseModel, Field

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()


class RecipeModel(BaseModel):
    dish_id: str
    title: str
    description: str
    ingredients: List[str]
    instructions: List[str]


# Add CORS middleware to allow all requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# Add middleware to log all requests
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Request: {request.method} {request.url}")
    logger.info(f"Headers: {dict(request.headers)}")
    response = await call_next(request)
    logger.info(f"Response status: {response.status_code}")
    return response


# Recipe data structure
fake_db: Dict[str, RecipeModel] = {
    "1": RecipeModel(
        dish_id="1",
        title="Classic Spaghetti Carbonara",
        description="Creamy Italian pasta dish with eggs, cheese, and pancetta",
        ingredients=[
            "400g spaghetti",
            "200g pancetta or guanciale, diced",
            "4 large eggs",
            "100g Pecorino Romano cheese, grated",
            "50g Parmesan cheese, grated",
            "Black pepper, freshly ground",
            "Salt",
        ],
        instructions=[
            "Bring a large pot of salted water to boil and cook spaghetti according to package directions.",
            "While pasta cooks, heat a large skillet over medium heat and cook pancetta until crispy.",
            "In a bowl, whisk together eggs, Pecorino Romano, Parmesan, and plenty of black pepper.",
            "Reserve 1 cup pasta water, then drain pasta.",
            "Add hot pasta to the skillet with pancetta and toss.",
            "Remove from heat and quickly stir in egg mixture, adding pasta water as needed to create a creamy sauce.",
            "Serve immediately with extra cheese and black pepper.",
        ],
    ),
    "2": RecipeModel(
        dish_id="2",
        title="Chicken Tikka Masala",
        description="Tender chicken in a rich, creamy tomato-based curry sauce",
        ingredients=[
            "2 lbs chicken breast, cut into chunks",
            "1 cup plain yogurt",
            "2 tbsp lemon juice",
            "2 tsp garam masala",
            "1 tsp cumin",
            "1 can (14 oz) crushed tomatoes",
            "1 cup heavy cream",
            "3 cloves garlic, minced",
            "1 inch ginger, grated",
            "1 onion, diced",
            "Salt and pepper to taste",
        ],
        instructions=[
            "Marinate chicken in yogurt, lemon juice, and half the spices for at least 30 minutes.",
            "Heat oil in a large pan and cook marinated chicken until golden. Set aside.",
            "In the same pan, sauté onion until soft, then add garlic and ginger.",
            "Add remaining spices and cook for 1 minute until fragrant.",
            "Add crushed tomatoes and simmer for 10 minutes.",
            "Stir in cream and return chicken to the pan.",
            "Simmer for 15 minutes until chicken is cooked through and sauce is thick.",
            "Serve with basmati rice and naan bread.",
        ],
    ),
    "3": RecipeModel(
        dish_id="3",
        title="Classic Caesar Salad",
        description="Crisp romaine lettuce with homemade Caesar dressing and croutons",
        ingredients=[
            "2 heads romaine lettuce, chopped",
            "1/2 cup Parmesan cheese, grated",
            "1 cup croutons",
            "3 cloves garlic, minced",
            "2 anchovy fillets",
            "1 egg yolk",
            "2 tbsp lemon juice",
            "1 tsp Dijon mustard",
            "1/3 cup olive oil",
            "Salt and pepper to taste",
        ],
        instructions=[
            "Wash and dry romaine lettuce thoroughly, then chop into bite-sized pieces.",
            "For dressing, mash garlic and anchovies into a paste.",
            "Whisk in egg yolk, lemon juice, and Dijon mustard.",
            "Slowly drizzle in olive oil while whisking to emulsify.",
            "Season with salt and pepper.",
            "Toss lettuce with dressing until well coated.",
            "Top with Parmesan cheese and croutons.",
            "Serve immediately.",
        ],
    ),
    "4": RecipeModel(
        dish_id="4",
        title="Chocolate Chip Cookies",
        description="Soft and chewy homemade chocolate chip cookies",
        ingredients=[
            "2 1/4 cups all-purpose flour",
            "1 tsp baking soda",
            "1 tsp salt",
            "1 cup butter, softened",
            "3/4 cup granulated sugar",
            "3/4 cup brown sugar",
            "2 large eggs",
            "2 tsp vanilla extract",
            "2 cups chocolate chips",
        ],
        instructions=[
            "Preheat oven to 375°F (190°C).",
            "In a bowl, whisk together flour, baking soda, and salt.",
            "In a large bowl, cream together butter and both sugars until fluffy.",
            "Beat in eggs one at a time, then vanilla.",
            "Gradually mix in flour mixture until just combined.",
            "Stir in chocolate chips.",
            "Drop rounded tablespoons of dough onto ungreased baking sheets.",
            "Bake for 9-11 minutes until golden brown.",
            "Cool on baking sheet for 5 minutes before transferring to wire rack.",
        ],
    ),
    "5": RecipeModel(
        dish_id="5",
        title="Beef Tacos",
        description="Seasoned ground beef tacos with fresh toppings",
        ingredients=[
            "1 lb ground beef",
            "1 packet taco seasoning",
            "8 taco shells",
            "1 cup lettuce, shredded",
            "1 cup cheddar cheese, shredded",
            "2 tomatoes, diced",
            "1/2 cup sour cream",
            "1/4 cup onion, diced",
            "Salsa",
            "Lime wedges",
        ],
        instructions=[
            "Brown ground beef in a large skillet over medium-high heat.",
            "Drain excess fat and add taco seasoning with water as directed on packet.",
            "Simmer for 5 minutes until sauce thickens.",
            "Warm taco shells according to package directions.",
            "Fill each shell with seasoned beef.",
            "Top with lettuce, cheese, tomatoes, onion, and sour cream.",
            "Serve with salsa and lime wedges.",
            "Enjoy immediately while shells are crispy.",
        ],
    ),
    "6": RecipeModel(
        dish_id="6",
        title="Banana Bread",
        description="Moist and flavorful banana bread perfect for breakfast or snack",
        ingredients=[
            "3 ripe bananas, mashed",
            "1/3 cup melted butter",
            "3/4 cup sugar",
            "1 egg, beaten",
            "1 tsp vanilla extract",
            "1 tsp baking soda",
            "Pinch of salt",
            "1 1/2 cups all-purpose flour",
            "Optional: 1/2 cup chopped walnuts",
        ],
        instructions=[
            "Preheat oven to 350°F (175°C) and grease a 9x5 inch loaf pan.",
            "In a large bowl, mix melted butter with mashed bananas.",
            "Stir in sugar, beaten egg, and vanilla extract.",
            "Sprinkle baking soda and salt over mixture and stir.",
            "Add flour and mix until just combined (don't overmix).",
            "Fold in walnuts if using.",
            "Pour batter into prepared loaf pan.",
            "Bake for 55-65 minutes until a toothpick comes out clean.",
            "Cool in pan for 10 minutes before removing to wire rack.",
        ],
    ),
}


@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.get("/all_dishes")
def get_all_dishes():
    return [recipe.model_dump() for recipe in fake_db.values()]


@app.get("/dish/{dish_id}")
def get_dish_by_id(dish_id: str):
    """Get a specific dish by ID"""
    recipe = fake_db.get(dish_id)
    if recipe:
        return recipe.model_dump()
    return None


@app.post("/add_dish_from_link")
async def add_dish_from_link(link: str):
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

    client = genai.Client(vertexai=True, project="personal-ai-264306", location="us-central1")
    response = await client.aio.models.generate_content(
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
    new_recipe = RecipeModel(
        dish_id=str(uuid.uuid4())[:8],
        title=response.parsed.title,
        description=response.parsed.description,
        ingredients=response.parsed.ingredients,
        instructions=response.parsed.instructions,
    )
    fake_db[new_recipe.dish_id] = new_recipe
    return new_recipe.model_dump()
