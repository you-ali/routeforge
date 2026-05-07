import time
from typing import Any, Dict

class SimpleCache:
    def __init__(self, max_size: int = 200, ttl_seconds: int = 86400):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self.cache: Dict[str, tuple[Any, float]] = {}

    def get(self, key: str) -> Any | None:
        if key in self.cache:
            value, timestamp = self.cache[key]
            if time.time() - timestamp > self.ttl_seconds:
                del self.cache[key]
                return None
            return value
        return None

    def set(self, key: str, value: Any):
        if len(self.cache) >= self.max_size:
            # Simple eviction: remove the oldest item
            oldest_key = min(self.cache, key=lambda k: self.cache[k][1])
            del self.cache[oldest_key]
        self.cache[key] = (value, time.time())

route_cache = SimpleCache(max_size=200, ttl_seconds=86400)
