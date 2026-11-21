"""
Vercel Serverless Entrypoint for RescueLink Backend API.
Delegates all /api/* routes to the FastAPI application and handles
Vercel path rewrites transparently.
"""

import sys
import os

# Insert backend directory to python path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi import Request
from main import app as fastapi_app

# Root API info route
@fastapi_app.get("/api")
@fastapi_app.get("/api/")
async def api_root():
    return {"status": "ok", "service": "RescueLink API", "version": "1.0.0"}

# Health check aliases
@fastapi_app.get("/health")
async def health_alias():
    return {"status": "ok", "service": "RescueLink API"}

async def app(scope, receive, send):
    """ASGI entrypoint that resolves the original URL path from Vercel headers."""
    if scope["type"] == "http":
        headers = dict(scope.get("headers", []))
        
        # Vercel supplies the original requested path in x-matched-path or x-forwarded-uri
        matched_path = headers.get(b"x-matched-path") or headers.get(b"x-forwarded-uri")
        if matched_path:
            path_str = matched_path.decode("utf-8").split("?")[0]
            scope["path"] = path_str
            scope["raw_path"] = path_str.encode("utf-8")
        else:
            current_path = scope.get("path", "")
            if not current_path.startswith("/api") and current_path != "/":
                prefixed = "/api" + (current_path if current_path.startswith("/") else "/" + current_path)
                scope["path"] = prefixed
                scope["raw_path"] = prefixed.encode("utf-8")
                
    await fastapi_app(scope, receive, send)

