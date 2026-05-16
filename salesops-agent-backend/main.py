"""SalesOps Agent API — FastAPI entry point."""

import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ── Logging ──────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# ── App ──────────────────────────────────────────────────────────────────
app = FastAPI(
    title="SalesOps Agent API",
    description="Backend for the Autonomous Content-to-Action SalesOps Agent",
    version="1.0.0",
)

# ── CORS ─────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ───────────────────────────────────────────────────────────────
@app.get("/health")
async def health_check():
    return {"status": "healthy"}


# ── Routers ──────────────────────────────────────────────────────────────
from api.endpoints import chat, runs  # noqa: E402

app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(runs.router, prefix="/api/runs", tags=["runs"])

logger.info("SalesOps Agent API initialised.")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
