from rag.utils.url_utils import append_api_path


def test_append_api_path_preserves_version_and_appends_endpoint_once():
    assert append_api_path("https://models.example/v1", "rerank") == "https://models.example/v1/rerank"
    assert append_api_path("https://models.example/v1/rerank", "/rerank/") == "https://models.example/v1/rerank"
    assert append_api_path("https://models.example/v1?tenant=1", "rerank") == "https://models.example/v1/rerank?tenant=1"
