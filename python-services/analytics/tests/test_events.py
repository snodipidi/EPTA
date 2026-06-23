from __future__ import annotations

from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_live() -> None:
    res = client.get("/health/live")
    assert res.status_code == 200


def test_events_contract() -> None:
    res = client.post(
        "/events",
        json={"name": "post.created", "userId": "u-1", "properties": {"postId": "p-1"}},
    )
    assert res.status_code == 202
    assert res.json() == {"accepted": True}


def test_events_accepts_extra_fields() -> None:
    # Аналитика не должна терять незнакомые поля события.
    res = client.post("/events", json={"name": "x", "custom": 123})
    assert res.status_code == 202
