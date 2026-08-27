import os
import secrets

from core.logger import logger
from fastapi import HTTPException, Request, status

API_TOKEN_ENV_VAR = "SANDBOX_EXECUTOR_MANAGER_API_TOKEN"
ALLOW_UNAUTHENTICATED_ENV_VAR = "SANDBOX_EXECUTOR_MANAGER_ALLOW_UNAUTHENTICATED"
_TRUTHY_FLAG_VALUES = {"1", "true", "yes", "on"}
_warned = False


def get_configured_api_token() -> str:
    return (os.getenv(API_TOKEN_ENV_VAR) or "").strip()


def unauthenticated_access_explicitly_allowed() -> bool:
    return (os.getenv(ALLOW_UNAUTHENTICATED_ENV_VAR) or "").strip().lower() in _TRUTHY_FLAG_VALUES


def warn_if_unauthenticated_opt_in() -> None:
    global _warned
    if _warned:
        return
    _warned = True
    logger.warning(
        "SECURITY WARNING: sandbox /run accepts unauthenticated requests because "
        "SANDBOX_EXECUTOR_MANAGER_ALLOW_UNAUTHENTICATED=true"
    )


def log_authentication_startup_state() -> None:
    if get_configured_api_token():
        logger.info("Sandbox executor /run authentication: shared-secret token configured")
    elif unauthenticated_access_explicitly_allowed():
        warn_if_unauthenticated_opt_in()
    else:
        logger.error("SANDBOX_EXECUTOR_MANAGER_API_TOKEN is unset; /run will fail closed with HTTP 503")


def _extract_request_token(request: Request) -> str:
    authorization = request.headers.get("Authorization", "")
    if authorization[:7].lower() == "bearer ":
        return authorization[7:].strip()
    return (request.headers.get("X-Sandbox-Token") or "").strip()


async def require_api_token(request: Request) -> None:
    configured_token = get_configured_api_token()
    if not configured_token:
        if unauthenticated_access_explicitly_allowed():
            warn_if_unauthenticated_opt_in()
            return
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Sandbox executor authentication is not configured; refusing unauthenticated /run",
        )

    provided_token = _extract_request_token(request)
    if not provided_token or not secrets.compare_digest(provided_token, configured_token):
        logger.warning("Rejected unauthenticated %s request", request.url.path)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid sandbox executor API token")
