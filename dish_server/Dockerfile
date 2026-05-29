FROM python:3.11.3
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV APP_HOME=/root

COPY uv.lock $APP_HOME/
COPY pyproject.toml $APP_HOME/
COPY app $APP_HOME/app


WORKDIR $APP_HOME
# --compile-bytecode precompiles .pyc at build time so the first import of the
# (heavy) Google Cloud libraries on a cold start doesn't pay compilation cost.
RUN uv sync --compile-bytecode

EXPOSE 8080
CMD ["uv", "run", "fastapi", "run", "app/main.py", "--host", "0.0.0.0", "--port", "8080"]
