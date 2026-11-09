"""Main FastAPI application entry point for Sutra."""

from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from apps.api.app.config import settings
from apps.api.app.errors import (
    ApiProblemError,
    api_problem_exception_handler,
    problem_response,
)
from apps.api.app.routers import (
    health_router,
    plans_router,
    sessions_router,
    usage_router,
    voice_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure directories exist
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.tts_cache_dir.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title=settings.brand.name,
    description=settings.brand.description,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Exception handlers
app.add_exception_handler(ApiProblemError, api_problem_exception_handler)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = exc.errors()
    return problem_response(
        status_code=422,
        code="VALIDATION_ERROR",
        title="Unprocessable Entity",
        detail="The request body or parameters failed validation.",
        instance=request.url.path,
        extra={"validation_errors": errors},
    )


# Support X-Forwarded-Proto, X-Forwarded-For behind AWS ALB and Nginx
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(health_router)
app.include_router(sessions_router)
app.include_router(plans_router)
app.include_router(voice_router)
app.include_router(usage_router)

# Mount frontend build in production if available
web_dist_path = Path(__file__).resolve().parent.parent.parent / "web" / "dist"
if web_dist_path.exists() and (web_dist_path / "index.html").exists():
    app.mount("/", StaticFiles(directory=str(web_dist_path), html=True), name="frontend")
