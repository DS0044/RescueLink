"""
Vercel Serverless Entrypoint for RescueLink Backend API.
Delegates all /api/* routes to the FastAPI application and handles
Vercel path rewrites transparently.
"""

import sys
import os
from urllib.parse import parse_qs, urlencode, unquote

# Insert backend directory to python path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi import Request
from main import app as fastapi_app
from database import ensure_db_initialized

# Ensure SQLite tables and demo accounts are seeded on cold start
try:
    ensure_db_initialized()
except Exception as e:
    print(f"Cold-start DB initialization notice: {e}")

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
    """ASGI entrypoint that resolves the original URL path from Vercel query or headers."""
    if scope["type"] == "http":
        headers = dict(scope.get("headers", []))
        query_string = scope.get("query_string", b"").decode("utf-8")
        parsed_qs = parse_qs(query_string) if query_string else {}
        
        target_path = None
        
        # 1. Check if rewritten query parameter __path was provided
        if "__path" in parsed_qs:
            raw_path = parsed_qs.pop("__path")[0]
            target_path = "/api/" + raw_path.lstrip("/") if raw_path else "/api"
            # Re-encode clean query string without __path
            scope["query_string"] = urlencode(parsed_qs, doseq=True).encode("utf-8")
            
        # 2. Check Vercel regex route matches header: x-now-route-matches (e.g. 1=auth%2Flogin)
        elif b"x-now-route-matches" in headers:
            matches_val = headers[b"x-now-route-matches"].decode("utf-8")
            parts = parse_qs(matches_val)
            if "1" in parts:
                raw_path = unquote(parts["1"][0])
                target_path = "/api/" + raw_path.lstrip("/") if raw_path else "/api"

        # 3. Check Vercel x-forwarded-uri
        elif b"x-forwarded-uri" in headers:
            fwd_uri = headers[b"x-forwarded-uri"].decode("utf-8").split("?")[0]
            if fwd_uri.startswith("/api"):
                target_path = fwd_uri
                
        # 4. Fallback check for scope path
        if not target_path:
            current_path = scope.get("path", "")
            if current_path not in ("/api/index.py", "/index.py", ""):
                if not current_path.startswith("/api"):
                    target_path = "/api" + (current_path if current_path.startswith("/") else "/" + current_path)
                else:
                    target_path = current_path
            else:
                target_path = "/api"

        if target_path:
            scope["path"] = target_path
            scope["raw_path"] = target_path.encode("utf-8")
                
    await fastapi_app(scope, receive, send)
