# EPTA recommendation-service.
# ВАЖНО: build context = ./python-services (нужен и shared/, и сам сервис).
#   docker build -f recommendation/Dockerfile ./python-services
FROM python:3.12-slim AS base

# uv — быстрый установщик пакетов.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_SYSTEM_PYTHON=1

WORKDIR /app

# Сначала общий пакет, затем сервис. Кэш слоёв: shared меняется реже.
COPY shared ./shared
COPY recommendation ./recommendation

# Ставим в системный python (без venv в контейнере).
RUN uv pip install --system ./shared ./recommendation

# Непривилегированный пользователь.
RUN useradd --create-home --uid 10001 appuser
USER appuser

WORKDIR /app/recommendation
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
