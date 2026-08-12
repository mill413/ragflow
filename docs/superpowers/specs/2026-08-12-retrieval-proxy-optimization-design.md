# Retrieval Proxy Optimization Design

## Goal

Create a standalone FastAPI retrieval proxy at the repository root that improves stability under 20 simultaneous requests without changing the downstream caller contract or the core result transformation.

The public contract remains:

- `GET /retrieve_page/`
- Required query parameter: `question`
- Existing optional query parameters and defaults: `kb_id`, `page`, and `page_size=1000`
- Response fields: `question`, `total_chunks`, and `chunks`
- Each simplified chunk retains `doc_type`, `id`, `similarity`, `term_similarity`, and `vector_similarity`
- `doc_type` and `id` continue to be derived with the existing filename and `domains` content rules

## Selected Approach

Use a process-local shared HTTP connection pool and a bounded concurrency gate around RAGFlow calls. Keep excess requests queued in the proxy instead of allowing all of them to overload RAGFlow simultaneously. Move response JSON parsing and chunk transformation to a worker thread so a large 1,000-chunk response does not block the FastAPI event loop.

This approach does not add caching, retries, pagination fan-out, or result-count reduction. Those mechanisms could change freshness, amplify downstream work, or alter retrieval semantics.

## Components and Data Flow

The root-level `retrieval_proxy.py` module will contain:

1. A FastAPI lifespan handler that creates one reusable `httpx.AsyncClient` and closes it during shutdown.
2. A process-local `asyncio.Semaphore` that bounds simultaneous calls to RAGFlow. Its default is 8 and is configurable through an environment variable.
3. A synchronous result transformation function containing the existing chunk processing logic. It will be invoked with `asyncio.to_thread`.
4. `search_knowledge_base`, which records queue and upstream timings, calls RAGFlow through the shared client, and returns the same `(chunks_or_none, page)` tuple as the original implementation.
5. The unchanged public `/retrieve_page/` and `/health` routes.

Request flow:

```text
caller
  -> GET /retrieve_page/?question=...
  -> wait for bounded RAGFlow slot
  -> POST /api/v1/searchbots/retrieval_test using pooled connection
  -> parse and simplify 1,000 chunks outside the event loop
  -> return original proxy response shape
```

## Configuration

Operational values will be configurable without changing callers:

- `RAGFLOW_RETRIEVAL_URL`: upstream endpoint URL
- `RAGFLOW_API_KEY`: upstream Beta API token
- `RAGFLOW_MAX_CONCURRENCY`: maximum in-flight RAGFlow requests, default `8`
- `RAGFLOW_CONNECT_TIMEOUT`: connection timeout in seconds, default `5`
- `RAGFLOW_READ_TIMEOUT`: response read timeout in seconds, default `180`
- `RAGFLOW_POOL_TIMEOUT`: connection-pool wait timeout in seconds, default `10`

The existing test endpoint remains the fallback URL for compatibility with the supplied service. No token will be committed: `RAGFLOW_API_KEY` is required at runtime, in accordance with the repository security policy.

## Compatibility and Error Handling

HTTP errors, invalid JSON, and unexpected processing failures retain the original behavior: `search_knowledge_base` returns `(None, page)`, and `/retrieve_page/` responds with the normal response object containing zero chunks. This avoids introducing a new error response contract.

The full upstream result will no longer be printed. Logs will include request ID, question, page, semaphore queue time, upstream time, transformation time, and returned chunk count without logging the full document content.

The original `domains` extraction assumes every matching segment contains a colon. The implementation will preserve the same intended extraction while safely producing an empty ID for malformed content instead of failing the entire request.

## Deployment Boundary

The semaphore is process-local. The initial recommended deployment is one Uvicorn worker with `RAGFLOW_MAX_CONCURRENCY=8`. If multiple proxy workers are used, their concurrency values must sum to the intended global RAGFlow limit, or a distributed limiter must be introduced separately.

This optimization protects RAGFlow from overload but does not increase RAGFlow's intrinsic throughput. Additional throughput requires independent RAGFlow API replicas and sufficient Elasticsearch and embedding-service capacity.

## Testing

Focused tests will verify:

- The public route retains its query defaults and response schema.
- The upstream payload retains `kb_id`, `question`, `page`, and `size=1000`.
- The existing `doc_type`, domain ID, and similarity transformations are preserved.
- Malformed or missing domain content does not discard the entire response.
- Concurrent calls never exceed the configured semaphore limit.
- The shared HTTP client is reused rather than constructed per request.
- HTTP and JSON failures retain the original zero-result public response behavior.

Validation will run the narrowest new test module first, then Ruff checks for the new Python files.
