import os
import json
from fastapi import APIRouter

router = APIRouter()

@router.get("/templates")
async def get_templates():
    themes_dir = os.path.join(os.path.dirname(__file__), "..", "themes")
    themes = []
    
    if os.path.exists(themes_dir):
        for filename in sorted(os.listdir(themes_dir)):
            if filename.endswith(".json"):
                with open(os.path.join(themes_dir, filename), "r") as f:
                    try:
                        theme_data = json.load(f)
                        themes.append(theme_data)
                    except json.JSONDecodeError:
                        pass
                        
    return {"themes": themes}
