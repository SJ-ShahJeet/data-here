"""Send one email over SMTP (STARTTLS). Only ever called after human approval."""

import smtplib
from email.message import EmailMessage

from datahere.config import env


def send(to: str, subject: str, body: str) -> None:
    host, user, password = env("SMTP_HOST"), env("SMTP_USER"), env("SMTP_PASSWORD")
    sender = env("FROM_EMAIL") or user
    missing = [k for k, v in {"SMTP_HOST": host, "SMTP_USER": user, "SMTP_PASSWORD": password, "FROM_EMAIL": sender}.items() if not v]
    if missing:
        raise RuntimeError(f"Email not configured: set {', '.join(missing)} in .env")

    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = sender, to, subject
    msg.set_content(body)
    with smtplib.SMTP(host, int(env("SMTP_PORT", "587")), timeout=30) as smtp:
        smtp.starttls()
        smtp.login(user, password)
        smtp.send_message(msg)
