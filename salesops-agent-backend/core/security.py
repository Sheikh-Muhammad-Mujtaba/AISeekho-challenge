"""Neon Auth (Better Auth) JWT verification for FastAPI.

Verifies JWTs issued by Neon Auth by fetching the JWKS from
the Neon Auth .well-known/jwks.json endpoint and validating
the token signature (EdDSA / Ed25519).
"""

import logging
from functools import lru_cache
from typing import Any

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt as jose_jwt
from jose.backends import ECKey  # noqa: F401
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from core.config import settings
from db.models import User
from db.session import get_db

logger = logging.getLogger(__name__)

security = HTTPBearer()


# ── JWKS cache ───────────────────────────────────────────────────────────

_jwks_cache: dict[str, Any] | None = None


async def _fetch_jwks() -> dict[str, Any]:
    """Fetch and cache the JWKS key set from Neon Auth."""
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache

    jwks_url = settings.NEON_AUTH_JWKS_URL
    if not jwks_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="NEON_AUTH_JWKS_URL is not configured",
        )

    async with httpx.AsyncClient() as client:
        resp = await client.get(jwks_url, timeout=10.0)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        logger.info("Fetched JWKS from %s (%d keys)", jwks_url, len(_jwks_cache.get("keys", [])))
        return _jwks_cache


def _get_signing_key(jwks: dict[str, Any], kid: str) -> dict[str, Any]:
    """Find the key matching the JWT header's kid."""
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No matching signing key found in JWKS",
    )


# ── Auth dependency ──────────────────────────────────────────────────────

async def get_current_user(
    token: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Verify the Neon Auth JWT and return the authenticated user.

    On first login the user row is created in our local `users` table
    so that we can attach workflow runs, audit traces, etc.
    """
    try:
        # Decode JWT header to get `kid` without full verification
        unverified_header = jose_jwt.get_unverified_header(token.credentials)
        kid = unverified_header.get("kid", "")

        # Fetch JWKS and locate the matching key
        try:
            jwks = await _fetch_jwks()
        except Exception as jwks_exc:
            logger.error("Failed to fetch JWKS: %s", jwks_exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Authentication service unavailable (JWKS failure)",
            )
            
        signing_key = _get_signing_key(jwks, kid)

        # Verify and decode the token
        algorithms = [unverified_header.get("alg", "EdDSA")]
        payload = jose_jwt.decode(
            token.credentials,
            signing_key,
            algorithms=algorithms,
            options={"verify_aud": False},
        )

        user_id: str = payload.get("sub", "")
        email: str = payload.get("email", "")

        if not user_id:
            logger.warning("Token verified but missing 'sub' claim")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing 'sub' claim",
            )

        # Upsert user in local DB
        try:
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalars().first()

            if not user:
                logger.info("Creating new user record for %s", email)
                user = User(id=user_id, email=email, role="sales_rep")
                db.add(user)
                await db.commit()
                await db.refresh(user)
        except Exception as db_exc:
            logger.error("Database error during user upsert: %s", db_exc)
            # Don't fail the whole request if DB is just slow, but we need the user object
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal database error during authentication",
            )

        return user

    except JWTError as exc:
        logger.warning("JWT verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_sales_manager(
    current_user: User = Depends(get_current_user),
) -> User:
    """Gate access to sales-manager-only endpoints."""
    if current_user.role != "sales_manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions — sales_manager role required",
        )
    return current_user
