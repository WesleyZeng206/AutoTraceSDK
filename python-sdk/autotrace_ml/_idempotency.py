import os
import threading
import time

_counter = 0
_lock = threading.Lock()


def new_key():
    global _counter
    with _lock:
        _counter += 1
        c = _counter
    return "{}-{}-{}".format(os.getpid(), time.time_ns(), c)
