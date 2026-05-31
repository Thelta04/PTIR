import jwt
from datetime import datetime, timedelta, timezone
from django.conf import settings
from rest_framework import authentication, exceptions
from .models import User, Manager


# -- Token helpers -----------------------------------------------

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


# -- DRF Authentication backend ---------------------------------

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


# -- DRF Permission class ---------------------------------------

from rest_framework.permissions import BasePermission

class IsManager(BasePermission):
    """Only allows access if the authenticated user has a Manager profile."""
    message = 'Forbidden. Only Managers can perform this action.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Robust check: works even if request.user is a SimpleLazyObject or there are model class mismatches
        user_id = getattr(request.user, 'id', None)
        if not user_id:
            return False
            
        return Manager.objects.filter(user_id=user_id).exists()


class IsTripParticipant(BasePermission):
    """Only allows access if the authenticated user is the client who took the trip."""
    message = 'Forbidden. You are not a participant in this trip.'

    def has_permission(self, request, view):
        if not hasattr(request, 'user') or not request.user:
            return False
            
        trip_id = request.data.get('trip_id')
        if not trip_id:
            return False
            
        from .models import Trip
        return Trip.objects.filter(id=trip_id, client__user=request.user).exists()


from drf_spectacular.extensions import OpenApiAuthenticationExtension

class JWTAuthenticationScheme(OpenApiAuthenticationExtension):
    target_class = 'api.authentication.JWTAuthentication'
    name = 'JWTAuthentication'
    
    def get_security_definition(self, auto_schema):
        return {
            'type': 'http',
            'scheme': 'bearer',
            'bearerFormat': 'JWT',
        }
