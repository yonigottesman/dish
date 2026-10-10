import asyncio
import io
import logging
import re
import textwrap

import aiohttp
from bs4 import BeautifulSoup
from google import genai
from google.cloud import documentai_v1, firestore, pubsub_v1, storage
from google.genai import types
from langdetect import detect
from PIL import Image, ImageDraw
from pydantic import BaseModel, Field

from app.config import settings
from app.crud import mark_recipe_failed, update_recipe_from_processing
from app.models import DishImportType, DishStatus, PubSubMessage, RecipeModel


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


class ProcessDishCallback:
    def __init__(
        self,
        logger: logging.Logger,
        storage_client: storage.Client,
        genai_client: genai.Client,
        documentai_processor_name: str,
        documentai_client: documentai_v1.DocumentProcessorServiceAsyncClient,
        db: firestore.AsyncClient,
        loop: asyncio.AbstractEventLoop,
    ):
        self.logger = logger
        self.storage_client = storage_client
        self.genai_client = genai_client
        self.documentai_processor_name = documentai_processor_name
        self.documentai_client = documentai_client
        self.db = db
        self.loop = loop
        self.logger.info("ProcessDishCallback initialized with loop: %s", loop)

    def __call__(self, message: pubsub_v1.subscriber.message.Message):
        self.logger.info("=" * 50)
        self.logger.info("CALLBACK RECEIVED MESSAGE")
        try:
            data = PubSubMessage.model_validate_json(message.data.decode("utf-8"))
            self.logger.info(
                "Parsed message - dish_id: %s, type: %s, username: %s", data.dish_id, data.import_type, data.username
            )
            self.logger.info("Text data present: %s", data.text_data is not None)
            self.logger.info("Link data present: %s", data.link_data_url is not None)
            self.logger.info("Image data present: %s", data.image_data_gcs_path is not None)

            # Check if loop is running
            self.logger.info("Loop is running: %s", self.loop.is_running())
            self.logger.info("Loop is closed: %s", self.loop.is_closed())

            # Run async processing on the main event loop
            self.logger.info("Scheduling coroutine on main loop...")
            future = asyncio.run_coroutine_threadsafe(self._process_dish(data), self.loop)
            self.logger.info("Future created: %s", future)
            self.logger.info("Waiting for future result...")
            result = future.result(timeout=330)
            self.logger.info("Future completed with result: %s", result)

        except Exception as e:
            self.logger.error("Error processing message: %s", e, exc_info=True)
            # Infrastructure failures must be redelivered, not silently lost.
            if 'future' in locals():
                future.cancel()
            message.nack()
        else:
            self.logger.info("Acknowledging message")
            message.ack()
            self.logger.info("Message acknowledged")
            self.logger.info("=" * 50)

    async def _process_dish(self, data: PubSubMessage):
        """Route to appropriate processor based on import type"""
        self.logger.info("_process_dish started for dish_id: %s", data.dish_id)
        try:
            # Pub/Sub may redeliver after a restart or lost acknowledgement.
            snapshot = await self.db.collection("users").document(data.username).collection("recipes").document(data.dish_id).get()
            if not snapshot.exists or snapshot.to_dict().get("status") != DishStatus.PROCESSING.value:
                return
            async with asyncio.timeout(240):
                if data.import_type == DishImportType.LINK:
                    await self._process_from_link(data)
                elif data.import_type == DishImportType.TEXT:
                    await self._process_from_text(data)
                elif data.import_type == DishImportType.IMAGE:
                    await self._process_from_image(data)
                else:
                    raise ValueError(f"Unknown import type: {data.import_type}")

            self.logger.info("_process_dish completed successfully for dish_id: %s", data.dish_id)

        except Exception as e:
            self.logger.error("Failed to process dish %s: %s", data.dish_id, e, exc_info=True)
            self.logger.info("Marking recipe as failed...")
            await mark_recipe_failed(
                self.db,
                data.username,
                data.dish_id,
                str(e) or "Recipe processing timed out. Please try again.",
            )
            self.logger.info("Recipe marked as failed")

    @staticmethod
    def _is_instagram_url(url: str) -> bool:
        return bool(re.match(r"https?://(www\.)?instagram\.com/", url))

    @staticmethod
    def _extract_instagram_caption(html_page: str) -> str | None:
        """Extract post caption from Instagram's og:description meta tag."""
        soup = BeautifulSoup(html_page, "html.parser")
        og_desc = soup.find("meta", attrs={"property": "og:description"})
        if og_desc and og_desc.get("content"):
            content = og_desc["content"]
            # og:description format: "N likes, N comments - username on DATE: "CAPTION""
            # Strip the prefix to get just the caption
            match = re.search(r':\s*"(.+)"', content, re.DOTALL)
            if match:
                return match.group(1)
            return content
        return None

    async def _process_from_link(self, data: PubSubMessage):
        """Process recipe from URL"""
        self.logger.info("[LINK] Starting processing for dish %s", data.dish_id)
        self.logger.info("[LINK] URL: %s", data.link_data_url)

        headers = {
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "accept-language": "en-US,en;q=0.9",
            "cache-control": "max-age=0",
            "priority": "u=0, i",
            "sec-ch-ua": '"Brave";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"macOS"',
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": "none",
            "sec-fetch-user": "?1",
            "sec-gpc": "1",
            "upgrade-insecure-requests": "1",
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
        }

        self.logger.info("[LINK] Fetching URL...")
        async with aiohttp.ClientSession() as session:
            async with session.get(data.link_data_url, headers=headers) as response:
                self.logger.info("[LINK] Response status: %s", response.status)
                html_page = await response.text()
                self.logger.info("[LINK] Received HTML, length: %d chars", len(html_page))

        if self._is_instagram_url(data.link_data_url):
            self.logger.info("[LINK] Detected Instagram URL, extracting caption from og:description")
            caption = self._extract_instagram_caption(html_page)
            if caption:
                self.logger.info("[LINK] Extracted Instagram caption, length: %d chars", len(caption))
                text = caption
            else:
                self.logger.warning("[LINK] Failed to extract Instagram caption, falling back to generic extraction")
                soup = BeautifulSoup(html_page, "html.parser")
                text = soup.get_text()
                text = textwrap.dedent(text)
                text = re.sub(r"\n+", "\n", text)
        else:
            self.logger.info("[LINK] Parsing HTML with BeautifulSoup...")
            soup = BeautifulSoup(html_page, "html.parser")
            text = soup.get_text()
            text = textwrap.dedent(text)
            text = re.sub(r"\n+", "\n", text)
        self.logger.info("[LINK] Extracted text, length: %d chars", len(text))

        self.logger.info("[LINK] Calling GenAI...")
        genai_response = await self.genai_client.aio.models.generate_content(
            model="gemini-3-flash-preview",
            contents=(
                "Extract complete recipe from webpage text. Preserve original language. "
                "Capture ALL details: ingredients with precise measurements/quantities, "
                "ALL instruction stages (prep/cooking/assembly/finishing), temperatures, "
                "timing, techniques, serving sizes, tips. Include every step—no omissions. "
                "Maintain original sequence and specificity."
                "<text>" + text + "</text>"
            ),
            config={
                "response_mime_type": "application/json",
                "response_schema": RecipeForLLM,
            },
        )
        self.logger.info("[LINK] GenAI response received")

        parsed_recipe = genai_response.parsed
        self.logger.info("[LINK] Parsed recipe type: %s", type(parsed_recipe))
        assert isinstance(parsed_recipe, RecipeForLLM), "Response parsing failed"
        self.logger.info("[LINK] Recipe title: %s", parsed_recipe.title)

        recipe = RecipeModel(
            dish_id=data.dish_id,
            title=parsed_recipe.title,
            description=parsed_recipe.description,
            ingredients=parsed_recipe.ingredients,
            instructions=parsed_recipe.instructions,
            link=data.link_data_url,
            emoji=parsed_recipe.emoji,
            language=detect_language(parsed_recipe),
            status=DishStatus.COMPLETED,
        )
        self.logger.info("[LINK] RecipeModel created")

        self.logger.info("[LINK] Updating recipe in Firestore...")
        await update_recipe_from_processing(self.db, data.username, recipe)
        self.logger.info("[LINK] COMPLETED processing dish %s - Title: %s", data.dish_id, parsed_recipe.title)

    async def _process_from_text(self, data: PubSubMessage):
        """Process recipe from text"""
        self.logger.info("[TEXT] Starting processing for dish %s", data.dish_id)
        self.logger.info("[TEXT] Text length: %d chars", len(data.text_data) if data.text_data else 0)
        self.logger.info("[TEXT] Text preview: %s...", data.text_data[:100] if data.text_data else "None")

        self.logger.info("[TEXT] Calling GenAI...")
        genai_response = await self.genai_client.aio.models.generate_content(
            model="gemini-3-flash-preview",
            contents=(
                "Extract complete recipe from text. Preserve original language. "
                "Capture ALL details: ingredients with precise measurements/quantities, "
                "ALL instruction stages (prep/cooking/assembly/finishing), temperatures, "
                "timing, techniques, serving sizes, tips. Include every step—no omissions. "
                "Maintain original sequence and specificity."
                "<text>" + data.text_data + "</text>"
            ),
            config={
                "response_mime_type": "application/json",
                "response_schema": RecipeForLLM,
            },
        )
        self.logger.info("[TEXT] GenAI response received")

        parsed_recipe = genai_response.parsed
        self.logger.info("[TEXT] Parsed recipe type: %s", type(parsed_recipe))
        assert isinstance(parsed_recipe, RecipeForLLM), "Response parsing failed"
        self.logger.info("[TEXT] Recipe title: %s", parsed_recipe.title)
        self.logger.info("[TEXT] Recipe emoji: %s", parsed_recipe.emoji)
        self.logger.info("[TEXT] Ingredients count: %d", len(parsed_recipe.ingredients))
        self.logger.info("[TEXT] Instructions count: %d", len(parsed_recipe.instructions))

        recipe = RecipeModel(
            dish_id=data.dish_id,
            title=parsed_recipe.title,
            description=parsed_recipe.description,
            ingredients=parsed_recipe.ingredients,
            instructions=parsed_recipe.instructions,
            link=None,
            emoji=parsed_recipe.emoji,
            language=detect_language(parsed_recipe),
            status=DishStatus.COMPLETED,
        )
        self.logger.info("[TEXT] RecipeModel created with status: %s", recipe.status)

        self.logger.info("[TEXT] Updating recipe in Firestore for user: %s", data.username)
        await update_recipe_from_processing(self.db, data.username, recipe)
        self.logger.info("[TEXT] COMPLETED processing dish %s - Title: %s", data.dish_id, parsed_recipe.title)

    async def _process_from_image(self, data: PubSubMessage):
        """Process recipe from image"""
        self.logger.info("[IMAGE] Starting processing for dish %s", data.dish_id)
        self.logger.info("[IMAGE] GCS path: %s", data.image_data_gcs_path)

        # Download image from GCS
        self.logger.info("[IMAGE] Downloading from GCS...")
        blob = self.storage_client.bucket(settings.GCS_BUCKET_NAME).blob(data.image_data_gcs_path)
        jpeg_bytes = await asyncio.to_thread(blob.download_as_bytes, timeout=30)
        self.logger.info("[IMAGE] Downloaded %d bytes", len(jpeg_bytes))

        # Run Document AI OCR
        self.logger.info("[IMAGE] Running Document AI OCR...")
        raw_document = documentai_v1.RawDocument(
            content=jpeg_bytes,
            mime_type="image/jpeg",
        )
        request = documentai_v1.ProcessRequest(
            name=self.documentai_processor_name,
            raw_document=raw_document,
        )
        result = await self.documentai_client.process_document(request=request)
        document = result.document
        self.logger.info("[IMAGE] OCR completed, text length: %d chars", len(document.text))

        # Prepare image for GenAI
        self.logger.info("[IMAGE] Preparing image for GenAI...")
        pil_image = Image.open(io.BytesIO(jpeg_bytes)).convert("RGB")

        # Draw OCR blocks
        draw = ImageDraw.Draw(pil_image)
        for block in document.pages[0].blocks:
            layout = block.layout
            vertices = layout.bounding_poly.vertices
            polygon_points = [(vertex.x, vertex.y) for vertex in vertices]
            draw.polygon(polygon_points, outline="red", width=3)

        # Resize if needed
        max_width = 1024
        max_height = 1024
        width, height = pil_image.size

        if width > max_width or height > max_height:
            scale_factor = min(max_width / width, max_height / height)
            new_width = int(width * scale_factor)
            new_height = int(height * scale_factor)
            image_resized = pil_image.resize((new_width, new_height), Image.Resampling.LANCZOS)
            self.logger.info("[IMAGE] Resized from %dx%d to %dx%d", width, height, new_width, new_height)
        else:
            image_resized = pil_image
            self.logger.info("[IMAGE] Size %dx%d within limits", width, height)

        output_buffer = io.BytesIO()
        image_resized.save(output_buffer, format="JPEG")
        resized_bytes = output_buffer.getvalue()

        # Call GenAI with OCR text and image
        self.logger.info("[IMAGE] Calling GenAI with OCR text and image...")
        genai_response = await self.genai_client.aio.models.generate_content(
            model="gemini-3-flash-preview",
            contents=[
                (
                    "Extract complete recipe from OCR text and image. Cross-reference both sources for accuracy. "
                    "Preserve original language. Capture ALL details: ingredients with precise measurements/quantities "
                    "(verify from image if unclear in text), ALL instruction stages (prep/cooking/assembly/finishing), "
                    "temperatures, timing, techniques, serving sizes, tips, notes visible in image. "
                    "Include every step—no omissions. Maintain original sequence and specificity. "
                    "Use image to clarify ambiguous OCR text and capture visual details."
                    "<text>" + document.text + "</text>"
                ),
                types.Part.from_bytes(
                    data=resized_bytes,
                    mime_type="image/jpeg",
                ),
            ],  # type: ignore
            config={
                "response_mime_type": "application/json",
                "response_schema": RecipeForLLM,
            },
        )
        self.logger.info("[IMAGE] GenAI response received")

        parsed_recipe = genai_response.parsed
        assert isinstance(parsed_recipe, RecipeForLLM), "Response parsing failed"
        self.logger.info("[IMAGE] Recipe title: %s", parsed_recipe.title)

        # Move image from pending to final location
        self.logger.info("[IMAGE] Moving image to final location...")
        path_parts = data.image_data_gcs_path.split("/")
        user_id = path_parts[0]

        final_image_id = f"{data.dish_id}.jpeg"
        final_path = f"{user_id}/{final_image_id}"

        final_blob = self.storage_client.bucket(settings.GCS_BUCKET_NAME).blob(final_path)
        await asyncio.to_thread(final_blob.upload_from_string, jpeg_bytes, content_type="image/jpeg", timeout=30)
        self.logger.info("[IMAGE] Uploaded to: %s", final_path)

        # Create final recipe
        recipe = RecipeModel(
            dish_id=data.dish_id,
            title=parsed_recipe.title,
            description=parsed_recipe.description,
            ingredients=parsed_recipe.ingredients,
            instructions=parsed_recipe.instructions,
            link=None,
            emoji=parsed_recipe.emoji,
            image_ids=[final_image_id],
            language=detect_language(parsed_recipe),
            status=DishStatus.COMPLETED,
        )

        self.logger.info("[IMAGE] Updating recipe in Firestore...")
        await update_recipe_from_processing(self.db, data.username, recipe)
        self.logger.info("[IMAGE] COMPLETED processing dish %s - Title: %s", data.dish_id, parsed_recipe.title)
        # Keep the source until both Firestore documents have committed.
        try:
            await asyncio.to_thread(blob.delete, timeout=30)
        except Exception:
            self.logger.warning("Could not clean up pending image for %s", data.dish_id, exc_info=True)
