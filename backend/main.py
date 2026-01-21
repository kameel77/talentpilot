"""Main FastAPI application."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings

# Create FastAPI app
app = FastAPI(
    title="TalentPilot API",
    description="Manager Copilot powered by CliftonStrengths",
    version="0.1.0",
    debug=settings.debug
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    """Root endpoint."""
    return {
        "message": "Welcome to TalentPilot API",
        "version": "0.1.0",
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "environment": settings.environment
    }


# Import routers
from routers import auth, organizations, teams, users, talents, gallup, invitations, assistant, admin

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(organizations.router, prefix="/api/organizations", tags=["Organizations"])
app.include_router(teams.router, prefix="/api/teams", tags=["Teams"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(talents.router, prefix="/api", tags=["Talents"])
app.include_router(gallup.router, prefix="/api", tags=["Gallup"])
app.include_router(invitations.router, prefix="/api/invitations", tags=["Invitations"])
app.include_router(assistant.router, prefix="/api", tags=["Assistant"])
app.include_router(admin.router, prefix="/api", tags=["Admin"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
