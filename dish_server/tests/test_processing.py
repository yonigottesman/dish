import asyncio
import logging
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import HTTPException

from app.dependencies import get_pubsub_publisher
from app.dish import enqueue_dish_job
from app.models import DishImportType, PubSubMessage
from app.process_dish import ProcessDishCallback


class ProcessingTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.job = PubSubMessage(
            dish_id="dish",
            import_type=DishImportType.TEXT,
            username="user",
            text_data="recipe",
        )
        self.db = MagicMock()
        self.snapshot = MagicMock(exists=True)
        self.snapshot.to_dict.return_value = {"status": "processing"}
        self.db.collection.return_value.document.return_value.collection.return_value.document.return_value.get = AsyncMock(
            return_value=self.snapshot
        )
        self.callback = ProcessDishCallback(
            logging.getLogger("test"),
            MagicMock(),
            MagicMock(),
            "processor",
            MagicMock(),
            self.db,
            asyncio.get_running_loop(),
        )

    async def test_processing_timeout_records_failure(self):
        self.callback._process_from_text = AsyncMock(side_effect=TimeoutError())
        with patch(
            "app.process_dish.mark_recipe_failed", new_callable=AsyncMock
        ) as fail:
            await self.callback._process_dish(self.job)
            fail.assert_awaited_once_with(
                self.db,
                "user",
                "dish",
                "Recipe processing timed out. Please try again.",
            )

    async def test_completed_redelivery_does_not_process_again(self):
        self.snapshot.to_dict.return_value = {"status": "completed"}
        self.callback._process_from_text = AsyncMock()
        await self.callback._process_dish(self.job)
        self.callback._process_from_text.assert_not_awaited()

    async def test_publish_failure_records_terminal_state(self):
        with (
            patch("app.dish.publish_dish_job", side_effect=RuntimeError("offline")),
            patch("app.dish.mark_recipe_failed", new_callable=AsyncMock) as fail,
        ):
            with self.assertRaises(HTTPException) as error:
                await enqueue_dish_job(self.job, self.db, MagicMock(), MagicMock())
            self.assertEqual(error.exception.status_code, 503)
            fail.assert_awaited_once()

    async def test_missing_subscription_rejects_import(self):
        request = MagicMock()
        request.app.state.worker_ready = asyncio.Event()
        request.app.state.worker_ready.set()
        request.app.state.pubsub_subscriber.get_subscription.side_effect = RuntimeError(
            "missing subscription"
        )
        with self.assertRaises(HTTPException) as error:
            await get_pubsub_publisher(request).__anext__()
        self.assertEqual(error.exception.status_code, 503)

    async def test_db_failure_propagates_for_redelivery(self):
        self.callback._process_from_text = AsyncMock(
            side_effect=RuntimeError("model failure")
        )
        with patch(
            "app.process_dish.mark_recipe_failed",
            new_callable=AsyncMock,
            side_effect=RuntimeError("database offline"),
        ):
            with self.assertRaisesRegex(RuntimeError, "database offline"):
                await self.callback._process_dish(self.job)


if __name__ == "__main__":
    unittest.main()
