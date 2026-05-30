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
            logger.info(f"Attempting to send email to {to_email} via {self.server}:{self.port}")
            # We use SMTP (with STARTTLS) or SMTP_SSL depending on port, 
            # port 465 requires SMTP_SSL
            if self.port == 465:
                with smtplib.SMTP_SSL(self.server, self.port, timeout=10) as server:
                    server.login(self.username, self.password)
                    server.send_message(msg)
            else:
                with smtplib.SMTP(self.server, self.port, timeout=10) as server:
                    server.starttls()
                    server.login(self.username, self.password)
                    server.send_message(msg)
            logger.info(f"Email sent successfully to {to_email}")
        except Exception as e:
            logger.error(f"Failed to send email to {to_email} via {self.server}:{self.port}: {str(e)}")
            # Nie rzucamy błędu dalej żeby nie zablokować API, ale zalogujemy to


# Globalna instancja
email_service = EmailService()

def send_invitation_email(
    to_email: str,
    full_name: str,
    invite_token: str,
    team_name: str,
    org_name: str = "",
    language: str = "pl",
):
    """
    Send invitation email in PL or EN based on organization language setting.
    """
    frontend_url = getattr(settings, "frontend_url", "http://localhost:3000").rstrip("/")
    accept_link = f"{frontend_url}/join?token={invite_token}"

    org_label = org_name or team_name

    subjects = {
        "pl": f"Zaproszenie do {org_label} na TalentPilot",
        "en": f"You're invited to join {org_label} on TalentPilot",
    }

    html_bodies = {
        "pl": f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #7c3aed;">TalentPilot</h2>
            </div>
            <p>Witaj, <strong>{full_name}</strong>,</p>
            <p>Zostałeś/aś zaproszony/a do zespołu <strong>{team_name}</strong> w organizacji <strong>{org_label}</strong> w aplikacji <strong>TalentPilot</strong>.</p>
            <p>Kliknij poniższy przycisk, aby aktywować konto i ustawić hasło:</p>
            <p style="text-align: center; margin: 30px 0;">
                <a href="{accept_link}" style="background-color: #7c3aed; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Aktywuj konto</a>
            </p>
            <p>Jeśli przycisk nie działa, skopiuj poniższy link i wklej go do przeglądarki:</p>
            <p style="word-break: break-all; color: #666; font-size: 14px;"><a href="{accept_link}">{accept_link}</a></p>
            <p style="color: #888; font-size: 13px;">Link jest ważny przez 7 dni.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="font-size: 12px; color: #999; text-align: center;">Wiadomość została wygenerowana automatycznie. Prosimy na nią nie odpowiadać.</p>
        </body>
    </html>
    """,
        "en": f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #7c3aed;">TalentPilot</h2>
            </div>
            <p>Hi, <strong>{full_name}</strong>,</p>
            <p>You've been invited to the team <strong>{team_name}</strong> in <strong>{org_label}</strong> on <strong>TalentPilot</strong>.</p>
            <p>Click the button below to activate your account and set your password:</p>
            <p style="text-align: center; margin: 30px 0;">
                <a href="{accept_link}" style="background-color: #7c3aed; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Activate account</a>
            </p>
            <p>If the button doesn't work, copy this link into your browser:</p>
            <p style="word-break: break-all; color: #666; font-size: 14px;"><a href="{accept_link}">{accept_link}</a></p>
            <p style="color: #888; font-size: 13px;">This link is valid for 7 days.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="font-size: 12px; color: #999; text-align: center;">This message was generated automatically. Please do not reply.</p>
        </body>
    </html>
    """,
    }

    if language not in html_bodies:
        logger.warning("Unsupported invitation language %r, falling back to 'pl'", language)
    lang = language if language in html_bodies else "pl"
    email_service.send_email(to_email, subjects[lang], html_bodies[lang])


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


def send_team_added_email(to_email: str, full_name: str, team_name: str, org_name: str):
    """
    Wysyła email z informacją o dodaniu użytkownika do nowego zespołu.
    """
    frontend_url = getattr(settings, "frontend_url", "http://localhost:3000").rstrip("/")
    teams_link = f"{frontend_url}/dashboard/teams"

    subject = f"Zostałeś dodany do zespołu {team_name}"
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #7c3aed;">TalentPilot</h2>
            </div>

            <p>Witaj, <strong>{full_name}</strong>,</p>

            <p>Zostałeś/aś dodany/a do zespołu <strong>{team_name}</strong> w organizacji <strong>{org_name}</strong> w aplikacji <strong>TalentPilot</strong>.</p>

            <p>Możesz teraz przeglądać profil swojego zespołu i współpracować z innymi członkami.</p>

            <p style="text-align: center; margin: 30px 0;">
                <a href="{teams_link}" style="background-color: #7c3aed; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Przejdź do zespołów</a>
            </p>

            <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />

            <p style="font-size: 12px; color: #999; text-align: center;">
                Wiadomość została wygenerowana automatycznie. Prosimy na nią nie odpowiadać.
            </p>
        </body>
    </html>
    """
    email_service.send_email(to_email, subject, html_content)
