# Slim base: the full python:3.11.3 image is ~1GB and produced a 1.75GB final
# image, which Cloud Run had to pull on every cold start (min-instances=0).
# The slim image drops build tooling/docs we don't need at runtime and cuts the
# image to a few hundred MB, shrinking the cold-start image-pull time.
FROM python:3.11-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV APP_HOME=/root

COPY uv.lock $APP_HOME/
COPY pyproject.toml $APP_HOME/
COPY app $APP_HOME/app

WORKDIR $APP_HOME

# --no-dev excludes dev-only tooling (ipykernel + its heavy debugpy/jedi/pyzmq/
# IPython/tornado tree, ruff). That's ~35MB and a few thousand fewer files to
# read cold on startup.
# --compile-bytecode precompiles .pyc at build time so the first import of the
# (heavy) Google Cloud libraries on a cold start doesn't pay compilation cost.
ENV UV_COMPILE_BYTECODE=1
RUN uv sync --no-dev --compile-bytecode

EXPOSE 8080
# Invoke uvicorn directly from the synced venv instead of `uv run fastapi run`.
# This skips the `uv run` environment re-check and the FastAPI CLI's filesystem
# package discovery + extra typer/rich imports on every startup, going straight
# to importing app.main and binding the port.
CMD ["/root/.venv/bin/uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
