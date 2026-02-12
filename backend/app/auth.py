from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth

security = HTTPBearer()

# Alleen deze e-mailadressen mogen inloggen
ALLOWED_EMAILS = ["wim@opwolken.com", "daan@opwolken.com"]

# Gedeelde owner UID — alle data is gekoppeld aan dit account
# Beide gebruikers delen dezelfde klanten, facturen, uitgaven en instellingen
OWNER_UID = "jROgjVI5QnS8ojB21q1pxqMLY8I2"


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Verify Firebase ID token, check allowlist, return shared owner."""
    try:
        decoded_token = auth.verify_id_token(credentials.credentials)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ongeldige of verlopen token",
        )

    email = decoded_token.get("email", "").lower()
    if email not in ALLOWED_EMAILS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Geen toegang. Alleen opwolken-accounts zijn toegestaan.",
        )

    # Beide gebruikers krijgen dezelfde owner UID zodat ze alle data delen
    return {
        "uid": OWNER_UID,
        "email": email,
        "name": decoded_token.get("name", ""),
    }
