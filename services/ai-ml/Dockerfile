# syntax=docker/dockerfile:1
FROM python:3.12-slim AS base
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY pyproject.toml ./
COPY src ./src

FROM base AS dev
RUN --mount=type=cache,id=pip-cache,target=/root/.cache/pip \
    pip install --default-timeout=100 --retries 5 -e ".[dev]"
EXPOSE 8000
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

FROM base AS prod
RUN --mount=type=cache,id=pip-cache,target=/root/.cache/pip \
    pip install --default-timeout=100 --retries 5 .
EXPOSE 8000
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
