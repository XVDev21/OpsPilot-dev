from django.test import Client


def test_openapi_documents_bearer_auth_and_versioned_contract(client: Client) -> None:
    response = client.get("/api/v1/openapi.json")

    assert response.status_code == 200
    schema = response.json()
    assert schema["info"]["version"] == "1.0.0"
    assert schema["components"]["securitySchemes"]["WorkOSBearer"]["scheme"] == "bearer"
    assert "/api/v1/me" in schema["paths"]
    assert "/api/v1/runs" in schema["paths"]
