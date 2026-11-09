from typing import Any

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import request_id_ctx


class AppException(Exception):
    def __init__(
        self,
        code: str,
        title: str,
        status_code: int,
        detail: str,
        extra: dict[str, Any] | None = None,
    ) -> None:
        self.code = code
        self.title = title
        self.status_code = status_code
        self.detail = detail
        self.extra = extra or {}
        super().__init__(detail)


def make_problem_response(
    status_code: int,
    code: str,
    title: str,
    detail: str,
    request_id: str,
    extra: dict[str, Any] | None = None,
) -> JSONResponse:
    type_slug = code.lower().replace("_", "-")
    content: dict[str, Any] = {
        "type": f"https://voxspec.dev/errors/{type_slug}",
        "title": title,
        "status": status_code,
        "code": code,
        "detail": detail,
        "request_id": request_id,
    }
    if extra:
        content["extra"] = extra
    return JSONResponse(
        status_code=status_code,
        content=content,
        media_type="application/problem+json",
    )


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    req_id = request_id_ctx.get()
    return make_problem_response(
        status_code=exc.status_code,
        code=exc.code,
        title=exc.title,
        detail=exc.detail,
        request_id=req_id,
        extra=exc.extra,
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    req_id = request_id_ctx.get()
    return make_problem_response(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        code="VALIDATION_ERROR",
        title="Validation Error",
        detail="The request body or parameters failed validation.",
        request_id=req_id,
        extra={"errors": exc.errors()},
    )


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    req_id = request_id_ctx.get()
    code_map = {
        401: ("UNAUTHENTICATED", "Unauthenticated"),
        403: ("FORBIDDEN", "Forbidden"),
        404: ("NOT_FOUND", "Not Found"),
        413: ("TRANSCRIPT_TOO_LONG", "Payload Too Large"),
        429: ("RATE_LIMITED", "Too Many Requests"),
        502: ("PIPELINE_EXTRACT_FAILED", "Bad Gateway"),
        503: ("PROVIDER_UNAVAILABLE", "Service Unavailable"),
    }
    code, title = code_map.get(exc.status_code, ("INTERNAL_ERROR", "Internal Server Error"))
    return make_problem_response(
        status_code=exc.status_code,
        code=code,
        title=title,
        detail=str(exc.detail),
        request_id=req_id,
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    req_id = request_id_ctx.get()
    return make_problem_response(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        code="INTERNAL_SERVER_ERROR",
        title="Internal Server Error",
        detail="An unexpected internal error occurred.",
        request_id=req_id,
    )
