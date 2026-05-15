"""Gmail SMTP MCP tool adapter.

Sends emails via Gmail using App Password + SMTP (TLS).
Supports simulation_mode=True to safely test the agent loop
without actually sending emails.
"""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

from core.config import settings

logger = logging.getLogger(__name__)


async def send_email(
    to_email: str,
    subject: str,
    body: str,
    simulation_mode: bool = True,
) -> dict[str, Any]:
    """Send an email via Gmail SMTP.

    Args:
        to_email: Recipient address.
        subject: Email subject line.
        body: Plain-text email body.
        simulation_mode: If True, logs without sending. Default True.

    Returns:
        Dict with status and message.
    """
    if simulation_mode:
        logger.info(
            "send_email [simulation]: to=%s subject='%s'", to_email, subject
        )
        return {
            "status": "success",
            "message": "Simulated email send",
            "data": {"to": to_email, "subject": subject, "body": body},
        }

    # ── Real SMTP send ────────────────────────────────────────────────────
    gmail_user = settings.GMAIL_USER
    gmail_password = settings.GMAIL_APP_PASSWORD

    if not gmail_user or not gmail_password:
        return {
            "status": "error",
            "message": "GMAIL_USER or GMAIL_APP_PASSWORD is not configured",
        }

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = gmail_user
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(settings.GMAIL_SMTP_HOST, settings.GMAIL_SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(gmail_user, gmail_password)
            server.sendmail(gmail_user, to_email, msg.as_string())

        logger.info("send_email: sent to %s", to_email)
        return {
            "status": "success",
            "message": f"Email sent to {to_email}",
            "data": {"to": to_email, "subject": subject},
        }

    except smtplib.SMTPAuthenticationError:
        return {
            "status": "error",
            "message": "Gmail authentication failed — check GMAIL_USER and GMAIL_APP_PASSWORD",
        }
    except Exception as exc:
        logger.error("send_email error: %s", exc)
        return {"status": "error", "message": str(exc)}
