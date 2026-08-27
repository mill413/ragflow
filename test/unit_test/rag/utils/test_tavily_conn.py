from rag.utils import tavily_conn


class _StubClient:
    def __init__(self, results=None, error=None):
        self._results = results or []
        self._error = error

    def search(self, **_kwargs):
        if self._error is not None:
            raise self._error
        return {"results": self._results}


def _tavily(client) -> tavily_conn.Tavily:
    instance = tavily_conn.Tavily.__new__(tavily_conn.Tavily)
    instance.tavily_client = client
    return instance


def test_tavily_search_logs_only_exception_type(caplog):
    error = RuntimeError("private query key=tvly-secret")

    with caplog.at_level("ERROR"):
        assert _tavily(_StubClient(error=error)).search("private query") == []

    assert "private query" not in caplog.text
    assert "tvly-secret" not in caplog.text
    assert "RuntimeError" in caplog.text


def test_tavily_retrieve_chunks_does_not_log_user_data(caplog, monkeypatch):
    results = [{"url": "https://example.com", "title": "Result", "content": "secret page text", "score": 0.9}]
    monkeypatch.setattr(tavily_conn.rag_tokenizer, "tokenize", lambda text: text)

    with caplog.at_level("INFO"):
        retrieved = _tavily(_StubClient(results=results)).retrieve_chunks("private query")

    assert len(retrieved["chunks"]) == 1
    assert "private query" not in caplog.text
    assert "secret page text" not in caplog.text
