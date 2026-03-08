"""Standalone FastAPI sub-application for external API integrations.

Mounted at /api/external in main.py. Intentionally isolated from the internal
app: separate CORS policy, sanitized error responses, and independent middleware
stack — so external-facing changes never affect internal endpoints and vice versa.
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from routers import external

external_app = FastAPI(
    title="TalentPilot External API",
    description=(
        "Public API for third-party integrations with TalentPilot.\n\n"
        "**Authentication:** every request must include a valid `X-API-Key` header.\n\n"
        "Designed for LLM integrations, MCP servers, and partner platforms."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# CORS: open to any origin — external clients may come from anywhere.
# Credentials (cookies) are intentionally disabled; auth is API-key-only.
external_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["X-API-Key", "Content-Type", "Accept"],
)


@external_app.exception_handler(Exception)
async def sanitized_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """Return a generic 500 without leaking internal details to external clients."""
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


external_app.include_router(external.router, prefix="/v1", tags=["Gallup"])
