"""RFC 7807 Problem Details and Standard API Errors."""

from typing import Any, Dict, Optional
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse


class ApiProblemError(HTTPException):
    """Structured Problem Details error."""

    def __init__(
        self,
        status_code: int,
        code: str,
        title: str,
        detail: str,
        instance: Optional[str] = None,
        extra: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(status_code=status_code, detail=detail)
        self.code = code
        self.title = title
        self.detail = detail
        self.instance = instance
        self.extra = extra or {}


def problem_response(
    status_code: int,
    code: str,
    title: str,
    detail: str,
    instance: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> JSONResponse:
    content: Dict[str, Any] = {
        "type": f"https://sutra.app/errors/{code.lower()}",
        "title": title,
        "status": status_code,
        "detail": detail,
        "code": code,
    }
    if instance:
        content["instance"] = instance
    if extra:
        content.update(extra)

    return JSONResponse(
        status_code=status_code,
        content=content,
        media_type="application/problem+json",
    )


async def api_problem_exception_handler(request: Request, exc: ApiProblemError) -> JSONResponse:
    return problem_response(
        status_code=exc.status_code,
        code=exc.code,
        title=exc.title,
        detail=exc.detail,
        instance=request.url.path,
        extra=exc.extra,
    )
