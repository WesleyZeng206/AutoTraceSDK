import json
import os
import threading
import time
import uuid
from urllib import request, error


class IngestionQueue:
    """Background flush queue. Batches events on a worker thread and posts them to
    the ingestion service. Falls back to disk when the service can't be reached."""

    def __init__(self, *, api_key, base_url, flush_interval=5.0, batch_size=100,
                 max_queue=10000, disk_dir=None, timeout=5.0, debug=False):
        self.api_key = api_key
        self.url = base_url.rstrip("/") + "/v1/ml/llm/events/batch"
        self.flush_interval = flush_interval
        self.batch_size = batch_size
        self.max_queue = max_queue
        self.timeout = timeout
        self.debug = debug
        self.disk_dir = disk_dir

        self._buf = []
        self._lock = threading.Lock()
        self._wake = threading.Event()
        self._stopped = False
        self._thread = threading.Thread(
            target=self._loop, name="autotrace-ml-flush", daemon=True
        )
        self._thread.start()

    def enqueue(self, event):
        with self._lock:
            if len(self._buf) >= self.max_queue:
                self._buf.pop(0)
            self._buf.append(event)
            n = len(self._buf)
        if n >= self.batch_size:
            self._wake.set()

    def _loop(self):
        while not self._stopped:
            self._wake.wait(self.flush_interval)
            self._wake.clear()
            try:
                self.flush()
            except Exception as e:
                if self.debug:
                    print("autotrace_ml: flush loop error:", e)

    def _take(self):
        with self._lock:
            if not self._buf:
                return []
            batch = self._buf[:self.batch_size]
            self._buf = self._buf[self.batch_size:]
            return batch

    def flush(self):
        while True:
            batch = self._take()
            if not batch:
                break
            if not self._post(batch):
                self._spill(batch)
                return
        self._drain_disk()

    def _post(self, batch):
        body = json.dumps({"events": batch}).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "x-api-key": self.api_key,
            "Idempotency-Key": str(uuid.uuid4()),
        }
        req = request.Request(self.url, data=body, headers=headers, method="POST")
        try:
            with request.urlopen(req, timeout=self.timeout) as resp:
                code = resp.getcode()
                return 200 <= code < 300
        except error.HTTPError as e:
            # 4xx means the payload is bad; retrying won't help so drop it
            if 400 <= e.code < 500:
                if self.debug:
                    print("autotrace_ml: dropping batch, server returned", e.code)
                return True
            if self.debug:
                print("autotrace_ml: server error", e.code)
            return False
        except Exception as e:
            if self.debug:
                print("autotrace_ml: send failed:", e)
            return False

    def _spill(self, batch):
        if not self.disk_dir:
            with self._lock:
                self._buf[0:0] = batch
            return
        try:
            os.makedirs(self.disk_dir, exist_ok=True)
            name = "{}-{}.json".format(time.time_ns(), uuid.uuid4().hex)
            with open(os.path.join(self.disk_dir, name), "w") as f:
                json.dump(batch, f)
        except Exception as e:
            if self.debug:
                print("autotrace_ml: disk spill failed:", e)
            with self._lock:
                self._buf[0:0] = batch

    def _drain_disk(self):
        if not self.disk_dir or not os.path.isdir(self.disk_dir):
            return
        for name in sorted(os.listdir(self.disk_dir)):
            if not name.endswith(".json"):
                continue
            path = os.path.join(self.disk_dir, name)
            try:
                with open(path) as f:
                    batch = json.load(f)
            except Exception:
                try:
                    os.remove(path)
                except OSError:
                    pass
                continue
            if self._post(batch):
                try:
                    os.remove(path)
                except OSError:
                    pass
            else:
                return

    def close(self, timeout=5.0):
        self._stopped = True
        self._wake.set()
        self._thread.join(timeout=timeout)
        try:
            self.flush()
        except Exception as e:
            if self.debug:
                print("autotrace_ml: error on close flush:", e)
