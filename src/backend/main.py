import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Configure logging before importing other modules
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

# Reduce noise from third-party libraries
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

from api.routes import router
from api.state import get_state


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    state = get_state()
    state.load_models()
    yield
    # Shutdown (nothing to clean up)


def create_app() -> FastAPI:
    app = FastAPI(title="Lyre Studio API", lifespan=lifespan)
    
    # CORS: Use ALLOWED_ORIGINS env var in production, allow localhost for dev
    allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:8000").split(",")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router)
    return app


app = create_app()


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    logger.info(f"Starting Lyre Studio API on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
