import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Tuple
import hashlib
from cache import route_cache

router = APIRouter()

class RouteRequest(BaseModel):
    coordinates: List[Tuple[float, float]]  # list of [lat, lon]
    profile: str = "foot"

async def call_osrm(coordinates: list) -> dict:
    """Route via OSRM foot profile — prioritizes sidewalks, paths, pedestrian areas."""
    coord_str = ";".join(f"{lon},{lat}" for lat, lon in coordinates)
    url = f"https://router.project-osrm.org/route/v1/foot/{coord_str}"
    
    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            resp = await client.get(url, params={
                "overview": "full",
                "geometries": "geojson",
                "steps": "false",
                "annotations": "false",
                "continue_straight": "false",
                "alternatives": "false"
            })
            resp.raise_for_status()
        except httpx.RequestError as e:
            raise HTTPException(status_code=500, detail=f"Routing service unavailable: {str(e)}")
            
    data = resp.json()
    if data.get("code") != "Ok":
        raise HTTPException(status_code=400, detail=f"Routing failed: {data.get('message', 'unknown')}")
        
    route = data["routes"][0]
    return {
        "geojson": route["geometry"],
        "distance_m": route["distance"],
        "duration_s": route["duration"]
    }

@router.post("/route")
async def get_route(req: RouteRequest):
    # Always use foot — this is a running app
    key_str = f"route_foot_{str(req.coordinates)}"
    key = hashlib.md5(key_str.encode()).hexdigest()
    
    cached = route_cache.get(key)
    if cached:
        return cached
        
    result = await call_osrm(req.coordinates)
    route_cache.set(key, result)
    return result
