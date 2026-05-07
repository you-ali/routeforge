import asyncio
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import hashlib
from cache import route_cache

router = APIRouter()

class GeocodeRequest(BaseModel):
    addresses: List[str]

_last_nominatim_call = 0.0

async def call_nominatim(address: str) -> dict:
    global _last_nominatim_call
    now = asyncio.get_event_loop().time()
    wait = 1.1 - (now - _last_nominatim_call)
    if wait > 0:
        await asyncio.sleep(wait)
    _last_nominatim_call = asyncio.get_event_loop().time()

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": address, "format": "json", "limit": 1},
                headers={"User-Agent": "RouteForge/1.0"}
            )
            resp.raise_for_status()
        except httpx.RequestError:
            return {"error": "network_error", "address": address}

    results = resp.json()
    if not results:
        return {"error": "not_found", "address": address}
    r = results[0]
    return {"address": address, "lat": float(r["lat"]), "lon": float(r["lon"]), "display_name": r["display_name"]}

@router.post("/geocode")
async def geocode(req: GeocodeRequest):
    results = []
    for address in req.addresses:
        # cache key
        key = f"geocode_{hashlib.md5(address.strip().lower().encode()).hexdigest()}"
        cached = route_cache.get(key)
        if cached:
            results.append(cached)
            continue
        
        result = await call_nominatim(address)
        if "error" not in result:
            route_cache.set(key, result)
        results.append(result)
        
    return {"results": results}
