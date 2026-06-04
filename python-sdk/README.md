# autotrace-ml

Python SDK for AutoTrace LLM observability.

## Install

```bash
pip install -e .
```

## Usage

```python
import autotrace_ml

client = autotrace_ml.Client(api_key="at_live_...", base_url="http://localhost:4000")

with client.llm(provider="openai", model="gpt-4o", operation="chat") as span:
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
    )
    span.record(
        prompt_tokens=response.usage.prompt_tokens,
        completion_tokens=response.usage.completion_tokens,
        metadata={"session_id": session_id},
    )
```

Latency is mesaured automatically between `__enter__` and `__exit__`. If the block
raises, the event is recorded with `status="error"` and the exception type, then the
exception propagates.

### Auto-patching

```python
autotrace_ml.patch_openai(client, openai_client)
autotrace_ml.patch_anthropic(client, anthropic_client)
```

After patching, `chat.completions.create` / `messages.create` calls are traced with no
further code changes.

## Delivery

Events are buffered in memory and flushed by a background thread every `flush_interval`
seconds (default 5) or once `batch_size` events accumulate (default 100). If the
ingestion service is unreachable and `disk_queue_path` is set, batches spill to disk and
are replayed on the next successful flush.

```python
client = autotrace_ml.Client(
    api_key="at_live_...",
    base_url="http://localhost:4000",
    flush_interval=5.0,
    batch_size=100,
    disk_queue_path="./.autotrace-ml-queue",
    debug=True,
)
```

Call `client.flush()` to force a flush or `client.close()` to drain and stop the worker
(also runs automatically at process exit).
