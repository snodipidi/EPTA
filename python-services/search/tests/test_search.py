from __future__ import annotations

from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_live() -> None:
    res = client.get("/health/live")
    assert res.status_code == 200


def test_search_contract() -> None:
    res = client.post("/search", json={"query": "epta", "limit": 5})
    assert res.status_code == 200
    assert res.json() == {"postIds": []}
