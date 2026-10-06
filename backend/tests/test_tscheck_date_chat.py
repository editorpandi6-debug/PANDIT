import json
import uuid
from datetime import datetime, timezone


def _events(response):
    events = []
    event = None
    for line in response.text.splitlines():
        if line.startswith("event:"):
            event = line.split(":", 1)[1].strip()
        elif line.startswith("data:") and event:
            events.append((event, json.loads(line.split(":", 1)[1].strip())))
            event = None
    return events


def test_today_and_date_question_are_server_anchored(client):
    today = client.get("/pandi/today")
    assert today.status_code == 200, today.text
    expected = datetime.now(timezone.utc).date().isoformat()
    assert today.json()["today"] == expected
    session = f"tscheck-date-{uuid.uuid4()}"
    response = client.post("/pandi/chat/stream", json={"session_id": session, "message": "What is the current date?", "language": "en", "use_live_search": True, "file_ids": []})
    assert response.status_code == 200, response.text
    events = _events(response)
    done = [payload for event, payload in events if event == "done"]
    assert done and expected in done[-1]["content"]
