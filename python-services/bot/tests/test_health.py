from __future__ import annotations

from app.main import app
from fastapi.testclient import TestClient

# TestClient НЕ запускает lifespan → бот/юзербот/БД не поднимаются. Тесты проверяют
# каркас (liveness, контракт внутреннего API), не требуя живой инфраструктуры/токена.
client = TestClient(app)


def test_live() -> None:
    res = client.get("/health/live")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_notify_contract() -> None:
    # Внутренний API backend → бот: каркас подтверждает приём (202).
    res = client.post("/internal/notify", json={"chatId": 12345, "text": "привет"})
    assert res.status_code == 202
    assert res.json() == {"accepted": True}
