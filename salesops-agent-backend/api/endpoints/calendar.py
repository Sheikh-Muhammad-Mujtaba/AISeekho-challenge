import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.security import get_current_user, encrypt_token
from db.models import User
from db.session import get_db

logger = logging.getLogger(__name__)
router = APIRouter()

class SyncCalendarRequest(BaseModel):
    auth_code: str
    redirect_uri: str = "postmessage"  # Default for React Native / mobile SDKs


@router.post("/sync")
async def sync_google_calendar(
    request: SyncCalendarRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Exchange frontend authorization code for Google refresh token."""
    if not all([settings.GOOGLE_CALENDAR_CLIENT_ID, settings.GOOGLE_CALENDAR_CLIENT_SECRET]):
        raise HTTPException(
            status_code=500,
            detail="Google Calendar integration is not fully configured on the server."
        )

    # OAuth token exchange endpoint
    url = "https://oauth2.googleapis.com/token"
    payload = {
        "code": request.auth_code,
        "client_id": settings.GOOGLE_CALENDAR_CLIENT_ID,
        "client_secret": settings.GOOGLE_CALENDAR_CLIENT_SECRET,
        "redirect_uri": request.redirect_uri,
        "grant_type": "authorization_code",
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, data=payload)
            if response.status_code != 200:
                logger.error(f"Google Token Exchange Failed: {response.text}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Google OAuth exchange failed: {response.json().get('error_description', response.text)}"
                )
            
            data = response.json()
            refresh_token = data.get("refresh_token")
            
            # OAuth V2 only returns refresh_token on the first authorization!
            # If the user re-authorizes without revoking access, refresh_token might be null.
            if not refresh_token:
                logger.warning(f"No refresh_token returned for user {current_user.id}. Google may have already issued one.")
                # We do NOT raise an error here because if the user already has a saved refresh_token, we can keep using it.
                # But if they don't, we will notify them.
                if not current_user.google_refresh_token:
                    raise HTTPException(
                        status_code=400,
                        detail="Failed to obtain refresh token. Please revoke access from Google Account settings and try again to force a new consent screen."
                    )
            else:
                # Save the new refresh token (encrypted)
                current_user.google_refresh_token = encrypt_token(refresh_token)

            current_user.google_calendar_connected = True
            db.add(current_user)
            await db.commit()
            
            return {
                "status": "success",
                "message": "Google Calendar successfully connected.",
                "details": {
                    "email": current_user.email,
                    "calendar_connected": True
                }
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error connecting calendar: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/status")
async def get_calendar_status(
    current_user: User = Depends(get_current_user),
):
    """Check if the current user has connected their Google Calendar."""
    return {
        "is_connected": current_user.google_calendar_connected,
        "email": current_user.email if current_user.google_calendar_connected else None
    }


@router.post("/disconnect")
async def disconnect_calendar(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Disconnect Google Calendar from user profile."""
    current_user.google_refresh_token = None
    current_user.google_calendar_connected = False
    
    db.add(current_user)
    await db.commit()
    
    return {
        "status": "success",
        "message": "Google Calendar successfully disconnected."
    }
