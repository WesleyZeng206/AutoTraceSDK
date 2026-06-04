import atexit
import time
from datetime import datetime, timezone

from ._idempotency import new_key
from ._queue import IngestionQueue


class LlmSpan:
    def __init__(self, queue, provider, model, operation, metadata):
        self._q = queue
        self.provider = provider
        self.model = model
        self.operation = operation
        self._metadata = dict(metadata) if metadata else {}
        self._prompt_tokens = None
        self._completion_tokens = None
        self._total_tokens = None
        self._estimated_cost_usd = None
        self._status = "success"
        self._error_type = None
        self._error_message = None
        self._start_ns = None
        self._started_at = None

    def record(self, prompt_tokens=None, completion_tokens=None, total_tokens=None,
               estimated_cost_usd=None, cost_usd=None, status=None,
               error_type=None, error_message=None, metadata=None):
        if prompt_tokens is not None:
            self._prompt_tokens = prompt_tokens
        if completion_tokens is not None:
            self._completion_tokens = completion_tokens
        if total_tokens is not None:
            self._total_tokens = total_tokens
        if estimated_cost_usd is not None:
            self._estimated_cost_usd = estimated_cost_usd
        elif cost_usd is not None:
            self._estimated_cost_usd = cost_usd
        if status is not None:
            self._status = status
        if error_type is not None:
            self._error_type = error_type
        if error_message is not None:
            self._error_message = error_message
        if metadata:
            self._metadata.update(metadata)
        return self

    def __enter__(self):
        self._start_ns = time.perf_counter_ns()
        self._started_at = datetime.now(timezone.utc)
        return self

    def __exit__(self, exc_type, exc, tb):
        if exc_type is not None:
            self._status = "error"
            self._error_type = exc_type.__name__
            self._error_message = str(exc)[:500] if exc is not None else None
        self._emit()
        return False

    def _emit(self):
        duration_ms = None
        if self._start_ns is not None:
            duration_ms = int((time.perf_counter_ns() - self._start_ns) / 1_000_000)

        if self._total_tokens is None and (
            self._prompt_tokens is not None or self._completion_tokens is not None
        ):
            self._total_tokens = (self._prompt_tokens or 0) + (self._completion_tokens or 0)

        event = {
            "idempotency_key": new_key(),
            "provider": self.provider,
            "model": self.model,
            "operation": self.operation,
            "started_at": self._started_at.isoformat() if self._started_at else None,
            "latency_ms": duration_ms,
            "status": self._status,
            "prompt_tokens": self._prompt_tokens,
            "completion_tokens": self._completion_tokens,
            "total_tokens": self._total_tokens,
            "estimated_cost_usd": self._estimated_cost_usd,
            "error_type": self._error_type,
            "error_message": self._error_message,
            "metadata": self._metadata or None,
        }
        self._q.enqueue({k: v for k, v in event.items() if v is not None})


class Client:
    def __init__(self, api_key, base_url="http://localhost:4000", flush_interval=5.0,
                 batch_size=100, disk_queue_path=None, max_queue=10000, timeout=5.0,
                 debug=False, flush_on_exit=True):
        if not api_key:
            raise ValueError("api_key is required")
        self.base_url = base_url.rstrip("/")
        self._queue = IngestionQueue(
            api_key=api_key,
            base_url=self.base_url,
            flush_interval=flush_interval,
            batch_size=batch_size,
            max_queue=max_queue,
            disk_dir=disk_queue_path,
            timeout=timeout,
            debug=debug,
        )
        if flush_on_exit:
            atexit.register(self.close)

    def llm(self, provider, model, operation="chat", metadata=None):
        return LlmSpan(self._queue, provider, model, operation, metadata)

    def flush(self):
        self._queue.flush()

    def close(self):
        self._queue.close()
