# EPTA analytics-service. build context = ./python-services
#   docker build -f analytics/Dockerfile ./python-services
FROM python:3.12-slim AS base

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_SYSTEM_PYTHON=1

WORKDIR /app

COPY shared ./shared
COPY analytics ./analytics

RUN uv pip install --system ./shared ./analytics

RUN useradd --create-home --uid 10001 appuser
USER appuser

WORKDIR /app/analytics
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
