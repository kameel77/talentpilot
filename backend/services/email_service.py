import smtplib
from email.message import EmailMessage
import logging
from typing import Optional

from config import settings

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.server = settings.smtp_server
        self.port = settings.smtp_port
        self.username = settings.smtp_username
        self.password = settings.smtp_password
        self.from_email = settings.smtp_from_email or "noreply@manager-copilot.com"
        self.from_name = settings.smtp_from_name or "Manager Copilot"

    def send_email(self, to_email: str, subject: str, html_content: str):
        """Send an email using configured SMTP or mock if not fully configured."""
        if not self.server or not self.port or not self.username or not self.password:
            logger.warning(
                f"SMTP not fully configured. Mock sending email."
                f"\nTo: {to_email}\nSubject: {subject}\nContent: {html_content}"
            )
            return

        msg = EmailMessage()
        msg['Subject'] = subject
        msg['From'] = f"{self.from_name} <{self.from_email}>"
        msg['To'] = to_email
        msg.set_content(html_content, subtype='html')

        try:
            # We use SMTP (with STARTTLS) or SMTP_SSL depending on port, 
            # port 465 requires SMTP_SSL
            if self.port == 465:
                with smtplib.SMTP_SSL(self.server, self.port) as server:
                    server.login(self.username, self.password)
                    server.send_message(msg)
            else:
                with smtplib.SMTP(self.server, self.port) as server:
                    server.starttls()
                    server.login(self.username, self.password)
                    server.send_message(msg)
            logger.info(f"Email sent successfully to {to_email}")
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            # Nie rzucamy błędu dalej żeby nie zablokować API, ale zalogujemy to


# Globalna instancja
email_service = EmailService()

def send_password_reset_email(to_email: str, reset_token: str):
    """
    Wysyła maila z linkiem do zresetowania hasła.
    """
    frontend_url = getattr(settings, "frontend_url", "http://localhost:3000")
    # Clean up frontend URL just in case
    frontend_url = frontend_url.rstrip("/")
    reset_link = f"{frontend_url}/reset-password?token={reset_token}"
    
    subject = "Manager Copilot - Zresetuj swoje hasło"
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #2563eb;">Manager Copilot</h2>
            </div>
            
            <p>Witaj,</p>
            
            <p>Otrzymaliśmy prośbę o zresetowanie hasła dla Twojego konta w aplikacji <strong>Manager Copilot</strong>.</p>
            
            <p>Jeśli to nie Ty prosiłeś o zmianę hasła, możesz bezpiecznie zignorować tę wiadomość.</p>
            
            <p style="text-align: center; margin: 30px 0;">
                <a href="{reset_link}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Zresetuj hasło</a>
            </p>
            
            <p>Jeśli przycisk nie działa, skopiuj poniższy link i wklej go do przeglądarki:</p>
            <p style="word-break: break-all; color: #666; font-size: 14px;">
                <a href="{reset_link}">{reset_link}</a>
            </p>
            
            <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
            
            <p style="font-size: 12px; color: #999; text-align: center;">
                Wiadomość została wygenerowana automatycznie. Prosimy na nią nie odpowiadać.
            </p>
        </body>
    </html>
    """
    email_service.send_email(to_email, subject, html_content)
