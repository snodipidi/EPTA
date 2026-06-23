"""Конфигурация сервиса из переменных окружения (pydantic-settings).

Значения по умолчанию рассчитаны на локальный запуск против compose-инфраструктуры
(`postgres`/`redis` на localhost). В Docker значения приходят из docker-compose.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Единые настройки для всех Python-сервисов EPTA."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Имя сервиса — попадает в логи и /health.
    service_name: str = "epta-python-service"

    # Подключения к общей инфраструктуре EPTA.
    # DATABASE_URL может прийти как в async-форме (postgresql+asyncpg://...),
    # так и в «призмовой» (postgresql://...?schema=public) — db.normalize_async_dsn
    # приведёт её к asyncpg и выкинет несовместимые query-параметры.
    database_url: str = "postgresql+asyncpg://epta:epta_dev_password@localhost:5432/epta"
    redis_url: str = "redis://localhost:6379"

    log_level: str = "INFO"

    # Пул соединений SQLAlchemy.
    db_pool_size: int = 5
    db_pool_max_overflow: int = 5


@lru_cache
def get_settings() -> Settings:
    """Кэшированный синглтон настроек."""
    return Settings()
