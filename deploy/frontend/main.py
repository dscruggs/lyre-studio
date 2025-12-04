"""
API Proxy service for Lyre Studio.
Handles /api/* requests from Firebase Hosting and proxies to the backend.
Uses Firebase Auth for user authentication and a whitelist for access control.
"""

import os
import logging
from pathlib import Path

from fastapi import FastAPI, Request, Response, HTTPException
import httpx
import google.auth.transport.requests
import google.oauth2.id_token
import firebase_admin
from firebase_admin import auth as firebase_auth

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Backend service URL (internal Cloud Run URL)
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

# Firebase project ID (required for token verification)
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "")

app = FastAPI(title="Lyre Studio API Proxy")

# Whitelist file path
WHITELIST_FILE = Path(__file__).parent / "allowed_users.txt"

# Initialize Firebase Admin SDK (only if project ID is set)
_firebase_initialized = False
if FIREBASE_PROJECT_ID:
    try:
        firebase_admin.initialize_app(options={"projectId": FIREBASE_PROJECT_ID})
        _firebase_initialized = True
        logger.info(f"Firebase Admin initialized for project: {FIREBASE_PROJECT_ID}")
    except Exception as e:
        logger.warning(f"Failed to initialize Firebase Admin: {e}")


def load_whitelist() -> set[str]:
    """Load allowed emails from whitelist file."""
    if not WHITELIST_FILE.exists():
        logger.warning(f"Whitelist file not found: {WHITELIST_FILE}")
        return set()
    
    emails = set()
    with open(WHITELIST_FILE) as f:
        for line in f:
            line = line.strip()
            # Skip empty lines and comments
            if line and not line.startswith("#"):
                emails.add(line.lower())
    return emails


# Load whitelist at startup
ALLOWED_USERS = load_whitelist()
logger.info(f"Loaded {len(ALLOWED_USERS)} users from whitelist")


def verify_firebase_token(request: Request) -> str | None:
    """
    Verify Firebase ID token from Authorization header.
    Returns the user's email if valid, None otherwise.
    """
    auth_header = request.headers.get("Authorization", "")
    
    if not auth_header.startswith("Bearer "):
        return None
    
    token = auth_header[7:]  # Remove "Bearer " prefix
    
    if not _firebase_initialized:
        logger.warning("Firebase not initialized, skipping token verification")
        return None
    
    try:
        decoded_token = firebase_auth.verify_id_token(token)
        email = decoded_token.get("email", "")
        return email
    except Exception as e:
        logger.warning(f"Token verification failed: {e}")
        return None


def check_whitelist(email: str) -> bool:
    """Check if email is in the whitelist."""
    if not ALLOWED_USERS:
        # If whitelist is empty, allow all authenticated users
        logger.warning("Whitelist is empty - allowing all authenticated users")
        return True
    return email.lower() in ALLOWED_USERS


def get_backend_auth_token() -> str | None:
    """Get Google ID token for service-to-service auth with backend."""
    if "localhost" in BACKEND_URL:
        return None  # No auth needed for local development
    
    try:
        auth_req = google.auth.transport.requests.Request()
        token = google.oauth2.id_token.fetch_id_token(auth_req, BACKEND_URL)
        return token
    except Exception as e:
        logger.warning(f"Failed to get backend auth token: {e}")
        return None


@app.get("/health")
async def health_check():
    """Health check endpoint for Cloud Run."""
    return {"status": "healthy"}


@app.get("/api/auth-check")
async def auth_check(request: Request):
    """
    Check if the authenticated user is authorized (in whitelist).
    Called by frontend after Firebase login to determine if user can access the app.
    """
    user_email = verify_firebase_token(request)
    
    if not user_email:
        return {"authorized": False, "reason": "Not authenticated"}
    
    if not check_whitelist(user_email):
        logger.info(f"Auth check failed for user: {user_email}")
        return {"authorized": False, "reason": "Not in whitelist", "email": user_email}
    
    logger.info(f"Auth check passed for user: {user_email}")
    return {"authorized": True, "email": user_email}


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy_to_backend(path: str, request: Request) -> Response:
    """Proxy all /api/* requests to the backend service with auth."""
    
    # Verify Firebase token and check whitelist
    user_email = verify_firebase_token(request)
    
    if not user_email:
        logger.warning(f"Unauthorized API request: /api/{path}")
        raise HTTPException(status_code=401, detail="Authentication required")
    
    if not check_whitelist(user_email):
        logger.warning(f"Access denied for user: {user_email}")
        raise HTTPException(status_code=403, detail="User not in whitelist")
    
    logger.info(f"API: {request.method} /api/{path} - user: {user_email}")
    
    # Build headers for backend request
    headers = {}
    # Forward content-type for file uploads
    if "content-type" in request.headers:
        headers["content-type"] = request.headers["content-type"]
    
    # Add service-to-service auth token for backend
    backend_token = get_backend_auth_token()
    if backend_token:
        headers["Authorization"] = f"Bearer {backend_token}"
    
    # Get request body
    body = await request.body()
    
    # Forward the request
    async with httpx.AsyncClient(timeout=300.0) as client:
        try:
            response = await client.request(
                method=request.method,
                url=f"{BACKEND_URL}/api/{path}",
                headers=headers,
                content=body,
                params=request.query_params,
            )
            
            # Log significant operations
            if path in ("synthesize", "translate"):
                logger.info(f"Completed: {path} - user: {user_email} - status: {response.status_code}")
            
            # Return the response, preserving headers
            return Response(
                content=response.content,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.headers.get("content-type"),
            )
        except httpx.RequestError as e:
            logger.error(f"Backend request failed: {e} - user: {user_email}")
            return Response(
                content=f"Backend unavailable: {e}",
                status_code=502,
            )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8080))
    logger.info(f"Starting API proxy service on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
