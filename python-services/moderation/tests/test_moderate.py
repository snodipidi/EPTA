from __future__ import annotations

from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_live() -> None:
    res = client.get("/health/live")
    assert res.status_code == 200


def test_moderate_contract() -> None:
    res = client.post(
        "/moderate",
        json={"contentId": "p-1", "contentType": "post", "text": "привет"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "APPROVED"
