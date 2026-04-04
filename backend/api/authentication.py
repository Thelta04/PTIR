import jwt
from datetime import datetime, timedelta, timezone
from django.conf import settings
from rest_framework import authentication, exceptions
from .models import User, Manager


# ── Token helpers ───────────────────────────────────────────────

def generate_tokens(user):
    """Return an (access, refresh) token pair for the given custom User."""
    now = datetime.now(timezone.utc)

    access_payload = {
        'user_id': user.id,
        'exp': now + timedelta(minutes=30),
        'iat': now,
        'type': 'access',
    }
    refresh_payload = {
        'user_id': user.id,
        'exp': now + timedelta(days=7),
        'iat': now,
        'type': 'refresh',
    }

    access  = jwt.encode(access_payload,  settings.SECRET_KEY, algorithm='HS256')
    refresh = jwt.encode(refresh_payload, settings.SECRET_KEY, algorithm='HS256')
    return access, refresh


def decode_token(token, expected_type='access'):
    """Decode and validate a JWT, returning the payload dict."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        raise exceptions.AuthenticationFailed('Token expired.')
    except jwt.InvalidTokenError:
        raise exceptions.AuthenticationFailed('Invalid token.')

    if payload.get('type') != expected_type:
        raise exceptions.AuthenticationFailed(f'Expected {expected_type} token.')

    return payload


# ── DRF Authentication backend ─────────────────────────────────

class JWTAuthentication(authentication.BaseAuthentication):
    """
    Reads `Authorization: Bearer <token>` and returns (user, payload).
    Works with the project's custom api.models.User, NOT django.contrib.auth.
    """
    def authenticate(self, request):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return None  # No JWT present — let other auth backends try

        token = auth_header.split(' ', 1)[1]
        payload = decode_token(token, expected_type='access')

        try:
            user = User.objects.get(pk=payload['user_id'])
        except User.DoesNotExist:
            raise exceptions.AuthenticationFailed('User not found.')

        return (user, payload)


# ── DRF Permission class ───────────────────────────────────────

from rest_framework.permissions import BasePermission

class IsManager(BasePermission):
    """Only allows access if the authenticated user has a Manager profile."""
    message = 'Forbidden. Only Managers can perform this action.'

    def has_permission(self, request, view):
        if not isinstance(request.user, User):
            return False
        return Manager.objects.filter(user=request.user).exists()
