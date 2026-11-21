"""
Vercel Serverless Entrypoint for RescueLink Backend API.
Delegates all /api/* routes to the FastAPI application.
"""

import sys
import os

# Insert backend directory to python path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from main import app
