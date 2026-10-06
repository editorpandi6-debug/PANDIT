import io
import uuid


def test_supported_file_upload_and_recoverable_validation(client):
    filename = f"tscheck-{uuid.uuid4()}.txt"
    uploaded = client.post("/pandi/files", files={"file": (filename, b"PANDI analysis fixture", "text/plain")})
    assert uploaded.status_code == 200, uploaded.text
    assert uploaded.json()["filename"] == filename
    empty = client.post("/pandi/files", files={"file": ("tscheck-empty.txt", b"", "text/plain")})
    assert empty.status_code == 400
    unsupported = client.post("/pandi/files", files={"file": ("tscheck.bin", b"data", "application/octet-stream")})
    assert unsupported.status_code == 415


def test_chat_history_persists_created_fixture(client):
    session = f"tscheck-history-{uuid.uuid4()}"
    response = client.post("/pandi/chat/stream", json={"session_id": session, "message": "What is the current date today?", "language": "en", "use_live_search": False, "file_ids": []})
    assert response.status_code == 200, response.text
    history = client.get(f"/pandi/history/{session}")
    assert history.status_code == 200, history.text
    roles = [message["role"] for message in history.json()["messages"]]
    assert roles == ["user", "assistant"]
