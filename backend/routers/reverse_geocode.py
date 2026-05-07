import httpx
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class ReverseGeocodeRequest(BaseModel):
    lat: float
    lon: float

@router.post("/reverse-geocode")
async def reverse_geocode(req: ReverseGeocodeRequest):
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={"lat": req.lat, "lon": req.lon, "format": "json"},
                headers={"User-Agent": "RouteForge/1.0"}
            )
            data = resp.json()
            addr = data.get("address", {})
            city = (addr.get("city") or addr.get("town") or
                    addr.get("village") or addr.get("municipality") or
                    addr.get("county") or "")
            country_code = addr.get("country_code", "").upper()
            return {
                "display_name": data.get("display_name", f"{req.lat:.5f}, {req.lon:.5f}"),
                "city": city,
                "country_code": country_code,
            }
        except Exception:
            return {"display_name": f"{req.lat:.5f}, {req.lon:.5f}", "city": "", "country_code": ""}
