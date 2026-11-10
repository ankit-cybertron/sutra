"""RFC 7807 Problem Details and Standard API Errors."""

import uuid
from typing import Any, Dict, Optional
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse


class ApiProblemError(HTTPException):
    """Structured RFC 7807 Problem Details error."""

    def __init__(
        self,
        status_code: int,
        code: str,
        title: str,
        detail: str,
        retry_after: Optional[int] = None,
        request_id: Optional[str] = None,
        instance: Optional[str] = None,
        extra: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(status_code=status_code, detail=detail)
        self.code = code
        self.title = title
        self.detail = detail
        self.retry_after = retry_after
        self.request_id = request_id or f"req_{uuid.uuid4().hex[:12]}"
        self.instance = instance
        self.extra = extra or {}


def problem_response(
    status_code: int,
    code: str,
    title: str,
    detail: str,
    retry_after: Optional[int] = None,
    request_id: Optional[str] = None,
    instance: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> JSONResponse:
    req_id = request_id or f"req_{uuid.uuid4().hex[:12]}"
    content: Dict[str, Any] = {
        "type": f"https://sutra.app/errors/{code.lower()}",
        "title": title,
        "status": status_code,
        "detail": detail,
        "code": code,
        "requestId": req_id,
    }
    
    if retry_after is not None:
        content["retryAfter"] = int(retry_after)
        
    if instance:
        content["instance"] = instance
        
    if extra:
        content.update(extra)

    headers = {}
    if status_code == 429 and retry_after is not None:
        headers["Retry-After"] = str(int(retry_after))

    return JSONResponse(
        status_code=status_code,
        content=content,
        headers=headers,
        media_type="application/problem+json",
    )


async def api_problem_exception_handler(request: Request, exc: ApiProblemError) -> JSONResponse:
    return problem_response(
        status_code=exc.status_code,
        code=exc.code,
        title=exc.title,
        detail=exc.detail,
        retry_after=exc.retry_after,
        request_id=exc.request_id,
        instance=request.url.path,
        extra=exc.extra,
    )
