"""Smoke-тесты recommendation-service: liveness + контракт заглушки.

БД/Redis не нужны: lifespan не запускается у TestClient без контекст-менеджера,
а заглушка не обращается к инфраструктуре. Для /health (readiness) поднимать стек
отдельно — это проверяется в Docker (см. README)."""

from __future__ import annotations

from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_live() -> None:
    res = client.get("/health/live")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_recommendations_contract() -> None:
    res = client.post("/recommendations", json={"userId": "u-1", "limit": 10})
    assert res.status_code == 200
    assert res.json() == {"postIds": []}
