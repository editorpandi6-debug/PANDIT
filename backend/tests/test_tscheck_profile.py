import uuid


def test_profile_round_trip_and_missing_is_rejected(client):
    profile_id = f"tscheck-profile-{uuid.uuid4()}"
    response = client.put(f"/pandi/profile/{profile_id}", json={"name": "TS Check Visitor", "avatar_data_url": None})
    assert response.status_code == 200, response.text
    assert response.json()["profile_id"] == profile_id
    assert response.json()["name"] == "TS Check Visitor"
    restored = client.get(f"/pandi/profile/{profile_id}")
    assert restored.status_code == 200
    assert restored.json()["name"] == "TS Check Visitor"
    missing = client.get(f"/pandi/profile/tscheck-missing-{uuid.uuid4()}")
    assert missing.status_code == 404
