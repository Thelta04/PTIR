import math
import os
import socket
import requests
from decimal import Decimal, ROUND_HALF_UP
from urllib.parse import urlparse

from django.db import connection, transaction
from django.utils import timezone
from rest_framework import views, status, serializers
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
try:
    import stripe
except ImportError:
    stripe = None
from .models import Taxi, User, Client, Driver, Manager, Shift, TimeInterval, Trip, Refueling
from .serializers import *
from .authentication import JWTAuthentication, IsManager, IsTripParticipant, generate_tokens, decode_token
from drf_spectacular.utils import extend_schema, inline_serializer

from .models import Taxi, User, Client, Driver, Manager, Shift, TimeInterval, Trip, Rating, Invoice
from .authentication import JWTAuthentication, IsManager, generate_tokens, decode_token
from .serializers import (
    CreateClientSerializer, UserSerializer, CreateDriverSerializer,
    DriverSerializer, CreateManagerSerializer, CreateTaxiSerializer,
    TaxiDetailSerializer, ShiftCreateSerializer, ShiftDetailSerializer,
    TripListSerializer, TripCreateSerializer, RatingListSerializer,
    RatingCreateSerializer, TripCancelSerializer, TripCompleteSerializer
)
from django.db import IntegrityError


 
 
PRICING_CONFIG = {
    'BASE_FARE': 2.50,
    'PRICE_PER_MIN_BASIC': 0.25,
    'PRICE_PER_MIN_LUXURY': 0.50,
    'NIGHT_MULTIPLIER': 1.25,
}

STRIPE_CURRENCY = os.environ.get('STRIPE_CURRENCY', 'eur')
# --- Views with Business Logic ---

class UserDeleteView(views.APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsManager]

    @extend_schema(
        summary="Delete a User (Manager only)",
        description="Deletes a user and all associated profiles (Client, Driver, Manager). Requires a valid Manager JWT token.",
        request=None,
        responses={
            204: None,
            403: inline_serializer(name="UserDeleteForbidden", fields={'error': serializers.CharField()}),
            404: inline_serializer(name="UserDeleteNotFound", fields={'error': serializers.CharField()})
        }
    )
    def delete(self, request, id):
        try:
            user = User.objects.get(pk=id)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        active_statuses = ['PENDING', 'DRIVER_ACCEPTED', 'CLIENT_ACCEPTED', 'IN_PROGRESS']
        if Trip.objects.filter(client__user=user, status__in=active_statuses).exists():
            return Response({"error": "Cannot delete a user that has active trips."}, status=status.HTTP_403_FORBIDDEN)

        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ClientCreateView(views.APIView):
    @extend_schema(
        summary="Create a new Client",
        description="Creates the base user and immediately associates the Client profile.",
        request=CreateClientSerializer,
        responses={201: inline_serializer(
            name='ClientCreateResponse',
            fields={'message': serializers.CharField(), 'id': serializers.IntegerField()}
        )}
    )
    def post(self, request):
        serializer = CreateClientSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data
            
            # Create the base User
            try:
                user = User.objects.create(
                    nif=data['nif'], name=data['name'], email=data['email'],
                    gender=data['gender'], password=data['password']
                )
                Client.objects.create(user=user)
                return Response({"message": "Client created successfully!", "id": user.id}, status=status.HTTP_201_CREATED)
            except IntegrityError as e:
                return Response({"error": "A user with the same NIF or email already exists."}, status=status.HTTP_400_BAD_REQUEST)
        
        # If validation fails (e.g. missing email), return 400 automatically
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ClientDetailView(views.APIView):
    authentication_classes = [JWTAuthentication]

    @extend_schema(
        summary="Get Client details",
        description="Returns the detailed information of a specific client based on the user ID.",
        responses={200: UserSerializer}
    )
    def get(self, request, id):
        try:
            # Find the user by id
            user = User.objects.get(pk=id)
            client = Client.objects.get(user=user)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        except Client.DoesNotExist:
            return Response({"error": "Client not found"}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = UserSerializer(client)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Update Client (Manager only)",
        description="Updates a client's user data. Requires a valid Manager JWT token.",
        request=ClientUpdateSerializer,
        responses={
            200: UserSerializer,
            403: inline_serializer(name="ClientUpdateForbidden", fields={'error': serializers.CharField()}),
            404: inline_serializer(name="ClientUpdateNotFound", fields={'error': serializers.CharField()}),
        }
    )
    def patch(self, request, id):
        if not request.user or not request.user.is_authenticated:
            return Response({"error": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
        if not Manager.objects.filter(user=request.user).exists():
            return Response({"error": "Forbidden. Only Managers can perform this action."}, status=status.HTTP_403_FORBIDDEN)

        try:
            client = Client.objects.select_related('user').get(user__id=id)
        except Client.DoesNotExist:
            return Response({"error": "Client not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = ClientUpdateSerializer(data=request.data, partial=True, context={'client': client})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        user = client.user

        for field in ['nif', 'name', 'email', 'gender', 'password']:
            if field in data:
                setattr(user, field, data[field])
        user.save()

        return Response(UserSerializer(client).data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Delete Client (Manager only)",
        description="Deletes a client if they have no associated trips. Requires a valid Manager JWT token.",
        request=None,
        responses={
            204: None,
            403: inline_serializer(name="ClientDeleteForbidden", fields={'error': serializers.CharField()}),
            404: inline_serializer(name="ClientDeleteNotFound", fields={'error': serializers.CharField()}),
        }
    )
    def delete(self, request, id):
        if not request.user or not request.user.is_authenticated:
            return Response({"error": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
        if not Manager.objects.filter(user=request.user).exists():
            return Response({"error": "Forbidden. Only Managers can perform this action."}, status=status.HTTP_403_FORBIDDEN)

        try:
            client = Client.objects.select_related('user').get(user__id=id)
        except Client.DoesNotExist:
            return Response({"error": "Client not found."}, status=status.HTTP_404_NOT_FOUND)

        if Trip.objects.filter(client=client).exists():
            return Response({"error": "Cannot delete a client that has associated trips."}, status=status.HTTP_403_FORBIDDEN)

        client.user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class ClientListView(views.APIView):
    @extend_schema(
        summary="List all Clients",
        description="Returns a list of all clients in the system.",
        responses=UserSerializer(many=True)
    )
    def get(self, request):
        clients = Client.objects.all()
        serializer = UserSerializer(clients, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class DriverCreateView(views.APIView):
    @extend_schema(
        summary="Create a new Driver",
        description="Creates the base user, client profile, and associates the license number and birth year to the Driver profile.",
        request=CreateDriverSerializer,
        responses={201: inline_serializer(
            name='DriverCreateResponse',
            fields={'message': serializers.CharField(), 'id': serializers.IntegerField()}
        )}
    )
    def post(self, request):
        serializer = CreateDriverSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data
            
            try:
                user = User.objects.create(
                    nif=data['nif'], name=data['name'], email=data['email'],
                    gender=data['gender'], password=data['password']
                )
                Client.objects.create(user=user)
                Driver.objects.create(
                    user=user, 
                    license_number=data['license_number'], 
                    birth_year=data['birth_year']
                )
                return Response({"message": "Driver created successfully!", "id": user.id}, status=status.HTTP_201_CREATED)
            except IntegrityError:
                return Response({"error": "A user with the same NIF or email already exists."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class DriverDetailView(views.APIView):
    authentication_classes = [JWTAuthentication]

    @extend_schema(
        summary="Get Driver details",
        description="Returns the detailed information of a specific driver based on the user ID.",
        responses={200: DriverSerializer}
    )
    def get(self, request, id):
        try:
            # Find the user by id
            user = User.objects.get(pk=id)
            driver = Driver.objects.get(user=user)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        except Driver.DoesNotExist:
            return Response({"error": "Driver not found"}, status=status.HTTP_404_NOT_FOUND)

        # Serialize and return the data
        serializer = DriverSerializer(driver)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Update Driver (Manager only)",
        description="Updates a driver's user data and driver-specific data. Requires a valid Manager JWT token.",
        request=DriverUpdateSerializer,
        responses={
            200: DriverSerializer,
            403: inline_serializer(name="DriverUpdateForbidden", fields={'error': serializers.CharField()}),
            404: inline_serializer(name="DriverUpdateNotFound", fields={'error': serializers.CharField()}),
        }
    )
    def patch(self, request, id):
        if not request.user or not request.user.is_authenticated:
            return Response({"error": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
        if not Manager.objects.filter(user=request.user).exists():
            return Response({"error": "Forbidden. Only Managers can perform this action."}, status=status.HTTP_403_FORBIDDEN)

        try:
            driver = Driver.objects.select_related('user').get(user__id=id)
        except Driver.DoesNotExist:
            return Response({"error": "Driver not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = DriverUpdateSerializer(data=request.data, partial=True, context={'driver': driver})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        user = driver.user

        for field in ['nif', 'name', 'email', 'gender', 'password']:
            if field in data:
                setattr(user, field, data[field])
        user.save()

        for field in ['license_number', 'birth_year']:
            if field in data:
                setattr(driver, field, data[field])
        driver.save()

        return Response(DriverSerializer(driver).data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Delete Driver (Manager only)",
        description="Deletes a driver if they have no associated shifts. Requires a valid Manager JWT token.",
        request=None,
        responses={
            204: None,
            403: inline_serializer(name="DriverDeleteForbidden", fields={'error': serializers.CharField()}),
            404: inline_serializer(name="DriverDeleteNotFound", fields={'error': serializers.CharField()}),
        }
    )
    def delete(self, request, id):
        if not request.user or not request.user.is_authenticated:
            return Response({"error": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
        if not Manager.objects.filter(user=request.user).exists():
            return Response({"error": "Forbidden. Only Managers can perform this action."}, status=status.HTTP_403_FORBIDDEN)

        try:
            driver = Driver.objects.select_related('user').get(user__id=id)
        except Driver.DoesNotExist:
            return Response({"error": "Driver not found."}, status=status.HTTP_404_NOT_FOUND)

        if Shift.objects.filter(driver=driver).exists():
            return Response({"error": "Cannot delete a driver that has associated shifts."}, status=status.HTTP_403_FORBIDDEN)

        driver.user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class DriverListView(views.APIView):
    @extend_schema(
        summary="List all Drivers",
        description="Returns a list of all drivers in the system.",
        responses=DriverSerializer(many=True)
    )
    def get(self, request):
        drivers = Driver.objects.all()
        serializer = DriverSerializer(drivers, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ManagerCreateView(views.APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsManager]

    @extend_schema(
        summary="Create a new Manager",
        description="Creates the base user and associates the Manager profile.",
        request=CreateManagerSerializer,
        responses={201: inline_serializer(
            name='ManagerCreateResponse',
            fields={'message': serializers.CharField(), 'id': serializers.IntegerField()}
        )}
    )
    def post(self, request):
        serializer = CreateManagerSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data
            try:
                user = User.objects.create(
                    nif=data['nif'], name=data['name'], email=data['email'],
                    gender=data['gender'], password=data['password']
                )
                Manager.objects.create(user=user)
                return Response({"message": "Manager created successfully!", "id": user.id}, status=status.HTTP_201_CREATED)
            except IntegrityError:
                return Response({"error": "A user with the same NIF or email already exists."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class TaxiCreateView(views.APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsManager]

    @extend_schema(
        summary="Create a new Taxi (Manager only)",
        description="Adds a new vehicle to the fleet. Requires a valid Manager JWT token.",
        request=CreateTaxiSerializer,
        responses={201: inline_serializer(
            name='TaxiCreateResponse',
            fields={'message': serializers.CharField(), 'license_plate': serializers.CharField()}
        )}
    )
    def post(self, request):
        serializer = CreateTaxiSerializer(data=request.data)
        
        if serializer.is_valid():
            serializer.save()
            
            return Response({
                "message": "Taxi createed successfully in the fleet!",
                "license_plate": serializer.data['license_plate']
            }, status=status.HTTP_201_CREATED)
            
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class TaxiUpdateMileageView(views.APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsManager]

    @extend_schema(
        summary="Update Taxi mileage (Manager only)",
        description="Updates the mileage of a specific taxi. Requires a valid Manager JWT token.",
        request=inline_serializer(
            name='TaxiUpdateMileageRequest',
            fields={'mileage': serializers.IntegerField()}
        ),
        responses={
            200: TaxiDetailSerializer,
            404: inline_serializer(name="TaxiUpdateNotFound", fields={'error': serializers.CharField()})
        }
    )
    def patch(self, request, license_plate):
        try:
            taxi = Taxi.objects.get(license_plate=license_plate)
        except Taxi.DoesNotExist:
            return Response({"error": "Taxi not found."}, status=status.HTTP_404_NOT_FOUND)

        mileage = request.data.get('mileage')
        if mileage is None:
            return Response({"error": "mileage is required."}, status=status.HTTP_400_BAD_REQUEST)
        if int(mileage) < 0:
            return Response({"error": "mileage cannot be negative."}, status=status.HTTP_400_BAD_REQUEST)

        taxi.mileage = mileage
        taxi.save()

        return Response(TaxiDetailSerializer(taxi).data, status=status.HTTP_200_OK)

class TaxiDetailView(views.APIView):
    @extend_schema(
        summary="Get Taxi details",
        description="Returns the detailed information of a specific taxi based on the license plate.",
    )
    def get(self, request, license_plate):
        try:
            taxi = Taxi.objects.get(license_plate=license_plate)
        except Taxi.DoesNotExist:
            return Response({"error": "Taxi not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(TaxiDetailSerializer(taxi).data)

class TaxiListView(views.APIView):
    @extend_schema(
        summary="List all Taxis",
        description="Returns a list of all taxis in the system.",
        responses=TaxiDetailSerializer(many=True)
    )
    def get(self, request):
        taxis = Taxi.objects.all()
        serializer = TaxiDetailSerializer(taxis, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
class TaxiDeleteView(views.APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsManager]

    @extend_schema(
        summary="Delete a Taxi (Manager only)",
        description="Deletes a taxi from the fleet. Only possible if it has no associated shifts. Requires a valid Manager JWT token.",
        request=None,
        responses={
            204: None,
            403: inline_serializer(name="TaxiDeleteForbidden", fields={'error': serializers.CharField()}),
            404: inline_serializer(name="TaxiDeleteNotFound", fields={'error': serializers.CharField()})
        }
    )
    def delete(self, request, license_plate):
        try:
            taxi = Taxi.objects.get(license_plate=license_plate)
            if Shift.objects.filter(taxi=taxi).exists():
                return Response({"error": "Cannot delete a taxi that has associated shifts."}, status=status.HTTP_403_FORBIDDEN)
            taxi.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Taxi.DoesNotExist:
            return Response({"error": "Taxi not found."}, status=status.HTTP_404_NOT_FOUND)
        
class ShiftCreateView(views.APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Create a new Shift (Manager or Driver)",
        description="Creates a new shift for a driver and a taxi within a specific time interval. Managers can schedule for any driver, while Drivers can only schedule for themselves.",
        request=ShiftCreateSerializer,
        responses={201: inline_serializer(
            name='ShiftCreateResponse',
            fields={'message': serializers.CharField(), 'shift_id': serializers.IntegerField()}
        )}
    )
    def post(self, request):
        serializer = ShiftCreateSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data
            
            user = request.user
            is_manager = Manager.objects.filter(user=user).exists()
            is_driver = Driver.objects.filter(user=user).exists()
            
            if not is_manager:
                if not is_driver or data['driver_id'] != user.id:
                    return Response({"error": "You can only schedule shifts for yourself."}, status=status.HTTP_403_FORBIDDEN)

            try:
                driver = Driver.objects.get(pk=data['driver_id'])
                taxi = Taxi.objects.get(license_plate=data['taxi_license_plate'])
            except Driver.DoesNotExist:
                return Response({"error": "Driver not found."}, status=status.HTTP_404_NOT_FOUND)
            except Taxi.DoesNotExist:
                return Response({"error": "Taxi not found."}, status=status.HTTP_404_NOT_FOUND)

            try:
                with transaction.atomic():
                    interval = TimeInterval.objects.create(
                        start_time=data['start_time'],
                        end_time=data['end_time']
                    )
                    shift = Shift.objects.create(
                        driver=driver,
                        taxi=taxi,
                        scheduled_interval=interval
                    )
                return Response({"message": "Shift created successfully!", "shift_id": shift.id}, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ShiftListView(views.APIView):
    @extend_schema(
        summary="List Driver Shifts",
        description="Returns a list of shifts assigned to a specific driver.",
        responses=ShiftDetailSerializer(many=True)
    )
    def get(self, request, id):
        try:
            driver = Driver.objects.get(user__id=id)
        except Driver.DoesNotExist:
            return Response({"error": "Driver not found"}, status=status.HTTP_404_NOT_FOUND)

        shifts = Shift.objects.filter(driver=driver)
        serializer = ShiftDetailSerializer(shifts, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class ShiftListViews(views.APIView):
    @extend_schema(
        summary="List all Shifts",
        description="Returns a list of all shifts in the system for managers.",
        responses=ShiftDetailSerializer(many=True)
    )
    def get(self, request):
        shifts = Shift.objects.all()
        serializer = ShiftDetailSerializer(shifts, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ShiftDeleteView(views.APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Delete a Shift (Manager or Driver)",
        description="Deletes a scheduled shift. Managers can delete any shift, drivers can only delete their own. Only possible if the shift has not started and has no trips.",
        request=None,
        responses={
            204: None,
            403: inline_serializer(name="ShiftDeleteForbidden", fields={'error': serializers.CharField()}),
            404: inline_serializer(name="ShiftDeleteNotFound", fields={'error': serializers.CharField()})
        }
    )
    def delete(self, request, id):
        try:
            shift = Shift.objects.get(pk=id)
        except Shift.DoesNotExist:
            return Response({"error": "Shift not found."}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        is_manager = Manager.objects.filter(user=user).exists()
        is_driver = Driver.objects.filter(user=user).exists()

        if not is_manager:
            if not is_driver or shift.driver.user != user:
                return Response({"error": "You can only delete your own shifts."}, status=status.HTTP_403_FORBIDDEN)

        if shift.real_interval is not None:
            return Response({"error": "Cannot delete a shift that has already started."}, status=status.HTTP_403_FORBIDDEN)
        if Trip.objects.filter(shift=shift).exists():
            return Response({"error": "Cannot delete a shift that has associated trips."}, status=status.HTTP_403_FORBIDDEN)

        shift.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class ShiftStartView(views.APIView):
    @extend_schema(
        summary="Start a shift (Clock-in)",
        description="Driver starts a shift.",
        request=None,
        responses={200: inline_serializer(name='ShiftStartResponse', fields={'message': serializers.CharField()})}
    )
    def patch(self, request, id):
        try:
            shift = Shift.objects.get(pk=id)
        except Shift.DoesNotExist:
            return Response({"error": "Shift not found."}, status=status.HTTP_404_NOT_FOUND)
        
        if shift.real_interval is not None:
            return Response({"error": "Shift has already started."}, status=status.HTTP_400_BAD_REQUEST)
        
        interval = TimeInterval.objects.create(
            start_time=timezone.now(),
            end_time=None
        )
        
        shift.real_interval = interval
        shift.save()
        return Response({"message": "Shift started successfully."}, status=status.HTTP_200_OK)

class ShiftEndView(views.APIView):
    @extend_schema(
        summary="End a shift (Clock-out)",
        description="Driver ends a shift.",
        request=None,
        responses={200: inline_serializer(name='ShiftEndResponse', fields={'message': serializers.CharField()})}
    )
    def patch(self, request, id):
        try:
            shift = Shift.objects.get(pk=id)
        except Shift.DoesNotExist:
            return Response({"error": "Shift not found."}, status=status.HTTP_404_NOT_FOUND)
        
        if shift.real_interval is None:
            return Response({"error": "Shift hasn't started yet."}, status=status.HTTP_400_BAD_REQUEST)
            
        if shift.real_interval.end_time is not None:
            return Response({"error": "Shift has already ended."}, status=status.HTTP_400_BAD_REQUEST)
            
        shift.real_interval.end_time = timezone.now()
        shift.real_interval.save()
        
        return Response({"message": "Shift ended successfully."}, status=status.HTTP_200_OK)


class LoginView(views.APIView):
    authentication_classes = []  # Public endpoint
    permission_classes = [AllowAny]

    @extend_schema(
        summary="Login",
        description="Validates credentials and returns the user profile. Managers also receive JWT access and refresh tokens.",
        request=inline_serializer(
            name='LoginRequest',
            fields={
                'email': serializers.EmailField(),
                'password': serializers.CharField()
            }
        ),
        responses={200: inline_serializer(
            name='LoginSuccessResponse',
            fields={
                'message': serializers.CharField(),
                'id': serializers.IntegerField(),
                'name': serializers.CharField(),
                'email': serializers.EmailField(),
                'type': serializers.CharField(),
                'profile_pic': serializers.IntegerField(),
                'access': serializers.CharField(),
                'refresh': serializers.CharField(),
            }
        )}
    )
    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        if not email or not password:
            return Response({"error": "Email and password are required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(email=email, password=password)
        except User.DoesNotExist:
            return Response({"error": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)

        if user.is_banned:
            return Response({"error": "Account suspended."}, status=status.HTTP_403_FORBIDDEN)

        # Determine user type
        user_type = None
        if Manager.objects.filter(user=user).exists():
            user_type = "MANAGER"
        elif Driver.objects.filter(user=user).exists():
            user_type = "DRIVER"
        elif Client.objects.filter(user=user).exists():
            user_type = "CLIENT"
        else:
            return Response({"error": "User has no associated profile."}, status=status.HTTP_403_FORBIDDEN)

        response_data = {
            "message": "Login successful!",
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "type": user_type,
            "profile_pic": user.profile_pic,
            "gender": user.gender,
        }

        if user_type == "DRIVER":
            try:
                driver = Driver.objects.get(user=user)
                response_data["birth_year"] = driver.birth_year
            except Driver.DoesNotExist:
                pass

        access, refresh = generate_tokens(user)
        response_data["access"] = access
        response_data["refresh"] = refresh

        return Response(response_data, status=status.HTTP_200_OK)


class UserProfilePicUpdateView(views.APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Update user profile picture",
        description="Updates the predefined profile picture id for a user. Valid values are 0 to 5. Users can update themselves; managers can update anyone.",
        request=inline_serializer(
            name='UserProfilePicUpdateRequest',
            fields={'profile_pic': serializers.IntegerField(min_value=0, max_value=5)}
        ),
        responses={
            200: inline_serializer(
                name='UserProfilePicUpdateResponse',
                fields={
                    'message': serializers.CharField(),
                    'id': serializers.IntegerField(),
                    'profile_pic': serializers.IntegerField(),
                }
            ),
            400: inline_serializer(name='UserProfilePicBadRequest', fields={'error': serializers.CharField()}),
            403: inline_serializer(name='UserProfilePicForbidden', fields={'error': serializers.CharField()}),
            404: inline_serializer(name='UserProfilePicNotFound', fields={'error': serializers.CharField()}),
        }
    )
    def patch(self, request, id):
        if request.user.id != id and not Manager.objects.filter(user=request.user).exists():
            return Response({"error": "You can only update your own profile picture."}, status=status.HTTP_403_FORBIDDEN)

        profile_pic = request.data.get('profile_pic')
        if profile_pic is None:
            return Response({"error": "profile_pic is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            profile_pic = int(profile_pic)
        except (TypeError, ValueError):
            return Response({"error": "profile_pic must be an integer between 0 and 5."}, status=status.HTTP_400_BAD_REQUEST)

        if profile_pic < 0 or profile_pic > 5:
            return Response({"error": "profile_pic must be between 0 and 5."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(id=id)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        user.profile_pic = profile_pic
        user.save(update_fields=['profile_pic'])

        return Response({
            "message": "Profile picture updated successfully.",
            "id": user.id,
            "profile_pic": user.profile_pic,
        }, status=status.HTTP_200_OK)
    
class BanView(views.APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsManager]

    @extend_schema(
        summary="Ban or Activate User (Manager only)",
        description="Toggles the suspension state (is_banned) of an account. Requires a valid Manager JWT token.",
        request=None,
        responses={200: inline_serializer(
            name='BanToggleResponse',
            fields={'message': serializers.CharField()}
        )}
    )
    def patch(self, request, id):
        try:
            user = User.objects.get(id=id)
            user.is_banned = not user.is_banned 
            user.save()
            
            status_text = "Banned" if user.is_banned else "Active"
            return Response({"message": status_text}, status=status.HTTP_200_OK)
            
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)


class TokenRefreshView(views.APIView):
    authentication_classes = []  # Public endpoint
    permission_classes = [AllowAny]

    @extend_schema(
        summary="Refresh JWT token",
        description="Returns a new access token given a valid refresh token.",
        request=inline_serializer(
            name='TokenRefreshRequest',
            fields={'refresh': serializers.CharField()}
        ),
        responses={200: inline_serializer(
            name='TokenRefreshResponse',
            fields={'access': serializers.CharField()}
        )}
    )
    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response({"error": "Refresh token is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payload = decode_token(refresh_token, expected_type='refresh')
            user = User.objects.get(pk=payload['user_id'])
            access, _ = generate_tokens(user)
            return Response({"access": access}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_401_UNAUTHORIZED)

# Trips
class ClientTripListView(views.APIView):
    @extend_schema(
        summary="List trips from a client",
        description="Returns all trips requested by a specific client user ID.",
        responses={200: TripListSerializer(many=True)}
    )
    def get(self, request, id):
        if not Client.objects.filter(user__id=id).exists():
            return Response({"error": "Client not found."}, status=status.HTTP_404_NOT_FOUND)

        trips = Trip.objects.select_related(
            'client__user',
            'shift__driver__user',
            'shift__taxi',
            'interval'
        ).filter(client__user_id=id).order_by('-interval__start_time')

        serializer = TripListSerializer(trips, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class DriverTripListView(views.APIView):
    @extend_schema(
        summary="List trips from a driver",
        description="Returns all trips assigned to a specific driver user ID.",
        responses={200: TripListSerializer(many=True)}
    )
    def get(self, request, id):
        if not Driver.objects.filter(user__id=id).exists():
            return Response({"error": "Driver not found."}, status=status.HTTP_404_NOT_FOUND)

        trips = Trip.objects.select_related(
            'client__user',
            'shift__driver__user',
            'shift__taxi',
            'interval'
        ).filter(shift__driver__user_id=id).order_by('-interval__start_time')

        serializer = TripListSerializer(trips, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class TripListView(views.APIView):
    @extend_schema(
        summary="List all trips",
        description="Returns all trips. Can be filtered by status. Optionally pass 'lat' and 'lon' query parameters to sort by distance from driver to the trip's origin.",
        responses={200: TripListSerializer(many=True)}
    )
    def get(self, request):
        status_filter = request.query_params.get('status', None)
        comfort_filter = request.query_params.get('comfort_level', None)
        passengers_filter = request.query_params.get('num_passengers', None)
        driver_id = request.query_params.get('driver_id', None)
        driver_lat = request.query_params.get('lat', None)
        driver_lon = request.query_params.get('lon', None)
        
        trips = Trip.objects.select_related(
            'client__user',
            'shift__driver__user',
            'shift__taxi',
            'interval'
        ).all()
        
        if status_filter:
            trips = trips.filter(status=status_filter)
        if comfort_filter:
            trips = trips.filter(comfort_level=comfort_filter)
            
        # Determine maximum allowed passengers
        max_passengers = None
        if driver_id:
            # Look for an active shift (clocked in, no end time)
            active_shift = Shift.objects.filter(
                driver__user_id=driver_id,
                real_interval__isnull=False,
                real_interval__end_time__isnull=True
            ).select_related('taxi').first()
            
            if active_shift:
                max_passengers = active_shift.taxi.num_passengers
                comfort_filter = active_shift.taxi.comfort_level

        # Fallback to the explicit query parameter if max_passengers wasn't resolved via driver_id
        if max_passengers is None and passengers_filter:
            try:
                max_passengers = int(passengers_filter)
            except ValueError:
                pass
        if comfort_filter is None and comfort_filter:
            try:
                comfort_filter = comfort_filter
            except ValueError:
                pass
        if max_passengers is not None:
            trips = trips.filter(num_passengers__lte=max_passengers)
        if comfort_filter is not None:
            trips = trips.filter(comfort_level=comfort_filter)
        
        trips_list = list(trips)

        if driver_lat and driver_lon:
            try:
                d_lat = float(driver_lat)
                d_lon = float(driver_lon)
                
                # Haversine formula inline or helper to calculate distance
                def haversine(lat1, lon1, lat2, lon2):
                    R = 6371.0 # Earth radius in km
                    dlat = math.radians(lat2 - lat1)
                    dlon = math.radians(lon2 - lon1)
                    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
                    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
                    return R * c

                for trip in trips_list:
                    if trip.originCoords:
                        try:
                            t_lat, t_lon = map(float, trip.originCoords.split(','))
                            trip._distance = haversine(d_lat, d_lon, t_lat, t_lon)
                        except ValueError:
                            trip._distance = float('inf')
                    else:
                        trip._distance = float('inf')
                
                # Sort the list by calculated distance
                trips_list.sort(key=lambda t: t._distance)
            except ValueError:
                pass # Ignore invalid lat/lon inputs

        serializer = TripListSerializer(trips_list, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

def geocode_address(address: str) -> str:
    try:
        response = requests.get(
            'https://nominatim.openstreetmap.org/search',
            params={'q': address, 'format': 'json', 'limit': 1},
            headers={'User-Agent': 'TuxyApp/1.0'},
            timeout=5
        )
        data = response.json()
        if data:
            return f"{data[0]['lat']},{data[0]['lon']}"
    except Exception:
        pass
    return ''

import math

def haversine_dist(c1: str, c2: str) -> float:
    try:
        la1, lo1 = map(float, c1.split(','))
        la2, lo2 = map(float, c2.split(','))
        R = 6371
        dLat = math.radians(la2 - la1)
        dLon = math.radians(lo2 - lo1)
        a = math.sin(dLat / 2) * math.sin(dLat / 2) + \
            math.cos(math.radians(la1)) * math.cos(math.radians(la2)) * \
            math.sin(dLon / 2) * math.sin(dLon / 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return round(R * c, 2)
    except Exception:
        return 0

def calculate_route_summary(origin_coords: str, dest_coords: str) -> tuple[float, float]:
    if not origin_coords or not dest_coords:
        return 0, 0
    
    try:
        ORS_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImYyOWMxNmNlY2ZjODQ4YzA5MmRmZDc4Y2MxMDRiMjZhIiwiaCI6Im11cm11cjY0In0='        
        # coords vêm em formato "lat,lon" mas ORS quer [lon, lat]
        origin_lat, origin_lon = origin_coords.split(',')
        dest_lat, dest_lon = dest_coords.split(',')
        
        response = requests.post(
            'https://api.openrouteservice.org/v2/directions/driving-car',
            headers={
                'Authorization': ORS_API_KEY,
                'Content-Type': 'application/json'
            },
            json={
                'coordinates': [
                    [float(origin_lon), float(origin_lat)],
                    [float(dest_lon), float(dest_lat)]
                ]
            },
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            summary = data['routes'][0]['summary']
            distance_km = round(summary['distance'] / 1000, 2)
            duration_minutes = round(summary['duration'] / 60, 2)
            return distance_km, duration_minutes
    except Exception:
        pass
        
    # Fallback if ORS fails
    dist = haversine_dist(origin_coords, dest_coords)
    # Estimate 2 mins per km as a rough city average
    return dist, round(dist * 2.0, 2)

def calculate_distance(origin_coords: str, dest_coords: str) -> float:
    distance_km, _ = calculate_route_summary(origin_coords, dest_coords)
    return distance_km

def is_night_period(dt) -> bool:
    local_time = timezone.localtime(dt).time()
    return local_time.hour >= 22 or local_time.hour < 7

def calculate_price(minutes: float, comfort_level: str, trip_time=None) -> float:
    price_per_min = PRICING_CONFIG['PRICE_PER_MIN_LUXURY'] if comfort_level == 'luxury' else PRICING_CONFIG['PRICE_PER_MIN_BASIC']
    price = PRICING_CONFIG['BASE_FARE'] + (minutes * price_per_min)
    if trip_time and is_night_period(trip_time):
        price *= PRICING_CONFIG['NIGHT_MULTIPLIER']
    return round(price, 2)

def amount_to_cents(amount) -> int:
    return int((Decimal(amount).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP) * 100).to_integral_value())

def normalize_checkout_url(url: str) -> str:
    parsed_url = urlparse(url)
    if parsed_url.scheme:
        return url
    return f"http://{url}"

class TripCreateView(views.APIView):
    @extend_schema(
        summary="Create a new trip (Client)",
        description="Client requests a new trip. Coordinates are automatically fetched via Nominatim.",
        request=TripCreateSerializer,
        responses={201: TripListSerializer}
    )
    def post(self, request):
        serializer = TripCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        
        try:
            client = Client.objects.get(user__id=data['client_id'])
        except Client.DoesNotExist:
            return Response({"error": "Client not found."}, status=status.HTTP_404_NOT_FOUND)

        active_statuses = ['PENDING', 'DRIVER_ACCEPTED', 'CLIENT_ACCEPTED', 'IN_PROGRESS']
        if Trip.objects.filter(client=client, status__in=active_statuses).exists():
            return Response(
                {"error": "Client already has an active trip."},
                status=status.HTTP_400_BAD_REQUEST
            )

        origin_coords = data.get('originCoords') or geocode_address(data['originAddress'])
        dest_coords = data.get('destCoords') or geocode_address(data['destAddress'])

        kilometers = 0
        estimated_minutes = 0
        if origin_coords and dest_coords:
            kilometers, estimated_minutes = calculate_route_summary(origin_coords, dest_coords)
        trip_time = data.get('scheduled_time') or timezone.now()
        estimated_price = calculate_price(estimated_minutes, data['comfort_level'], trip_time)

        interval = TimeInterval.objects.create(
            start_time=timezone.now(),
            end_time=None
        )
        
        trip = Trip.objects.create(
            client=client,
            shift=None,
            interval=interval,
            originAddress=data['originAddress'],
            destAddress=data['destAddress'],
            originCoords=origin_coords,
            destCoords=dest_coords,
            comfort_level=data['comfort_level'],
            num_passengers=data['num_passengers'],
            kilometers=round(kilometers, 2),
            price=estimated_price,
            status='PENDING'
        )
        
        response_serializer = TripListSerializer(trip)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


# --- Reports endpoints
class ReportsView(views.APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsManager]

    @extend_schema(
        summary="Aggregated trips report",
        description="Returns totals and subtotals (by driver and taxi) for completed trips in a date range.",
        responses={200: inline_serializer(name='ReportsResponse', fields={
            'total_trips': serializers.IntegerField(),
            'total_hours': serializers.FloatField(),
            'total_kilometers': serializers.FloatField(),
            'by_driver': serializers.ListField(child=serializers.DictField()),
            'by_taxi': serializers.ListField(child=serializers.DictField()),
        })}
    )
    def get(self, request):
        start = request.query_params.get('start_date')
        end = request.query_params.get('end_date')
        if not start or not end:
            return Response({'error': 'start_date and end_date are required (YYYY-MM-DD).'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from datetime import date
            start_date = date.fromisoformat(start)
            end_date = date.fromisoformat(end)
        except Exception:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        trips = Trip.objects.select_related('interval', 'shift__driver__user', 'shift__taxi').filter(
            status='COMPLETED',
            interval__start_time__date__gte=start_date,
            interval__start_time__date__lte=end_date
        )

        total_trips = trips.count()
        total_kilometers = 0.0
        total_hours = 0.0

        by_driver = {}
        by_taxi = {}

        for t in trips:
            kms = float(t.kilometers or 0)
            total_kilometers += kms
            if t.interval and t.interval.end_time and t.interval.start_time:
                delta = t.interval.end_time - t.interval.start_time
                hrs = delta.total_seconds() / 3600.0
            else:
                hrs = 0.0
            total_hours += hrs

            # driver grouping
            driver = getattr(t.shift, 'driver', None)
            if driver:
                d_id = driver.user.id
                d_name = driver.user.name
                if d_id not in by_driver:
                    by_driver[d_id] = {'driver_id': d_id, 'driver_name': d_name, 'trips': 0, 'hours': 0.0, 'kilometers': 0.0}
                by_driver[d_id]['trips'] += 1
                by_driver[d_id]['hours'] += hrs
                by_driver[d_id]['kilometers'] += kms

            # taxi grouping
            taxi = getattr(t.shift, 'taxi', None)
            if taxi:
                plate = taxi.license_plate
                if plate not in by_taxi:
                    by_taxi[plate] = {'taxi_plate': plate, 'trips': 0, 'hours': 0.0, 'kilometers': 0.0}
                by_taxi[plate]['trips'] += 1
                by_taxi[plate]['hours'] += hrs
                by_taxi[plate]['kilometers'] += kms

        by_driver_list = list(by_driver.values())
        by_taxi_list = list(by_taxi.values())

        by_driver_list.sort(key=lambda x: x['hours'], reverse=True)
        by_taxi_list.sort(key=lambda x: x['hours'], reverse=True)

        return Response({
            'total_trips': total_trips,
            'total_hours': total_hours,
            'total_kilometers': total_kilometers,
            'by_driver': by_driver_list,
            'by_taxi': by_taxi_list,
        }, status=status.HTTP_200_OK)


class RefuelReportView(views.APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsManager]

    def get(self, request):
        start = request.query_params.get('time_start')
        end = request.query_params.get('time_end')
        if not start or not end:
            return Response({'error': 'time_start and time_end are required (YYYY-MM-DD).'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            from datetime import date
            start_date = date.fromisoformat(start)
            end_date = date.fromisoformat(end)
        except Exception:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        refuels = Refueling.objects.filter(interval__start_time__date__gte=start_date, interval__start_time__date__lte=end_date)
        total_reab = refuels.count()
        total_litros = sum([float(r.liters or 0) for r in refuels])
        total_preco = sum([float(r.cost or 0) for r in refuels])
        total_kwh = sum([float(r.kwh or 0) for r in refuels])

        return Response([{
            'date_inicio': start,
            'date_fim': end,
            'total_reabastecimentos': total_reab,
            'total_litros': total_litros,
            'total_preco': total_preco,
            'total_kwh': total_kwh,
        }], status=status.HTTP_200_OK)


class TaxisReportView(views.APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsManager]

    def get(self, request):
        start = request.query_params.get('time_start')
        end = request.query_params.get('time_end')
        if not start or not end:
            return Response({'error': 'time_start and time_end are required (YYYY-MM-DD).'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            from datetime import date
            start_date = date.fromisoformat(start)
            end_date = date.fromisoformat(end)
        except Exception:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        trips = Trip.objects.filter(interval__start_time__date__gte=start_date, interval__start_time__date__lte=end_date, shift__taxi__isnull=False).select_related('shift__taxi')
        taxis_map = {}
        for t in trips:
            taxi = t.shift.taxi
            plate = taxi.license_plate
            if plate not in taxis_map:
                taxis_map[plate] = {'taxi_id': None, 'plate': plate, 'total_trips': 0, 'total_km': 0.0, 'active_days': set()}
            taxis_map[plate]['total_trips'] += 1
            taxis_map[plate]['total_km'] += float(t.kilometers or 0)
            if t.interval and t.interval.start_time:
                taxis_map[plate]['active_days'].add(t.interval.start_time.date())

        result = []
        for plate, v in taxis_map.items():
            result.append({'taxi_id': None, 'plate': plate, 'total_trips': v['total_trips'], 'total_km': v['total_km'], 'active_days': len(v['active_days'])})

        return Response(result, status=status.HTTP_200_OK)


class ClientsReportView(views.APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsManager]

    def get(self, request):
        start = request.query_params.get('time_start')
        end = request.query_params.get('time_end')
        if not start or not end:
            return Response({'error': 'time_start and time_end are required (YYYY-MM-DD).'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            from datetime import date
            start_date = date.fromisoformat(start)
            end_date = date.fromisoformat(end)
        except Exception:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        trips = Trip.objects.filter(interval__start_time__date__gte=start_date, interval__start_time__date__lte=end_date).select_related('client__user')
        clients_map = {}
        for t in trips:
            client = t.client
            cid = client.user.id
            if cid not in clients_map:
                clients_map[cid] = {'client_id': cid, 'name': client.user.name, 'total_trips': 0, 'total_spent': 0.0, 'passengers': []}
            clients_map[cid]['total_trips'] += 1
            clients_map[cid]['total_spent'] += float(t.price or 0)
            clients_map[cid]['passengers'].append(t.num_passengers or 0)

        result = []
        for cid, v in clients_map.items():
            avg_pass = (sum(v['passengers']) / len(v['passengers'])) if v['passengers'] else 0
            result.append({'client_id': cid, 'name': v['name'], 'total_trips': v['total_trips'], 'total_spent': v['total_spent'], 'average_passengers': avg_pass})

        return Response(result, status=status.HTTP_200_OK)
    
class TripAcceptView(views.APIView):
    @extend_schema(
        summary="Accept a trip (Driver)",
        description="Driver accepts a PENDING trip by associating a shift.",
        request=inline_serializer(
            name='TripAcceptRequest',
            fields={'shift_id': serializers.IntegerField()}
        ),
        responses={200: TripListSerializer}
    )
    def patch(self, request, id):
        try:
            trip = Trip.objects.select_related('client__user', 'interval').get(id=id)
        except Trip.DoesNotExist:
            return Response({"error": "Trip not found."}, status=status.HTTP_404_NOT_FOUND)

        if trip.status != 'PENDING':
            return Response({"error": f"Trip cannot be accepted. Current status: {trip.status}"}, status=status.HTTP_400_BAD_REQUEST)

        shift_id = request.data.get('shift_id')
        if not shift_id:
            return Response({"error": "shift_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            shift = Shift.objects.select_related('taxi', 'driver').get(id=shift_id)
        except Shift.DoesNotExist:
            return Response({"error": "Shift not found."}, status=status.HTTP_404_NOT_FOUND)

        if shift.real_interval is None:
            return Response({"error": "Shift has not started yet."}, status=status.HTTP_400_BAD_REQUEST)

        if shift.real_interval.end_time is not None:
            return Response({"error": "Shift has already ended."}, status=status.HTTP_400_BAD_REQUEST)

        trip.shift = shift
        trip.status = 'DRIVER_ACCEPTED'
        trip.save()

        return Response(TripListSerializer(trip).data, status=status.HTTP_200_OK)

class TripClientAcceptView(views.APIView):
    @extend_schema(
        summary="Accept a trip (Client)",
        description="Client confirms the trip after the driver has accepted it.",
        request=None,
        responses={200: TripListSerializer}
    )
    def patch(self, request, id):
        try:
            trip = Trip.objects.select_related(
                'client__user',
                'shift__driver__user',
                'shift__taxi',
                'interval'
            ).get(id=id)
        except Trip.DoesNotExist:
            return Response({"error": "Trip not found."}, status=status.HTTP_404_NOT_FOUND)

        if trip.status != 'DRIVER_ACCEPTED':
            return Response(
                {"error": f"Trip cannot be accepted. Current status: {trip.status}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Calculate and store fixed price at acceptance
        _, duration_minutes = calculate_route_summary(trip.originCoords, trip.destCoords)
        trip.price = calculate_price(duration_minutes, trip.comfort_level, timezone.now())

        trip.status = 'CLIENT_ACCEPTED'
        trip.save()

        return Response(TripListSerializer(trip).data, status=status.HTTP_200_OK)
    
class TripPickupView(views.APIView):
    @extend_schema(
        summary="Pickup client (Driver)",
        description="Driver confirms the client pickup, setting the trip to IN_PROGRESS.",
        request=None,
        responses={200: TripListSerializer}
    )
    def patch(self, request, id):
        try:
            trip = Trip.objects.select_related(
                'client__user',
                'shift__driver__user',
                'shift__taxi',
                'interval'
            ).get(id=id)
        except Trip.DoesNotExist:
            return Response({"error": "Trip not found."}, status=status.HTTP_404_NOT_FOUND)

        if trip.status != 'CLIENT_ACCEPTED':
            return Response(
                {"error": f"Trip cannot be started. Current status: {trip.status}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Atualiza o intervalo existente em vez de criar um novo
        trip.interval.start_time = timezone.now()
        trip.interval.end_time = None
        trip.interval.save()

        trip.status = 'IN_PROGRESS'
        trip.save()

        return Response(TripListSerializer(trip).data, status=status.HTTP_200_OK)

class RouteGeometryView(views.APIView):
    @extend_schema(
        summary="Get route geometry (Driver)",
        description="Proxies request to OpenRouteService to get the route geometry between origin and destination.",
        responses={200: inline_serializer(name='RouteResponse', fields={'geometry': serializers.CharField(), 'distance': serializers.FloatField(), 'duration': serializers.FloatField()})}
    )
    def get(self, request):
        origin = request.query_params.get('origin')
        dest = request.query_params.get('dest')
        if not origin or not dest:
            return Response({"error": "Origin and destination are required."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            ORS_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImYyOWMxNmNlY2ZjODQ4YzA5MmRmZDc4Y2MxMDRiMjZhIiwiaCI6Im11cm11cjY0In0='
            o_lat, o_lon = origin.split(',')
            d_lat, d_lon = dest.split(',')
            
            response = requests.post(
                'https://api.openrouteservice.org/v2/directions/driving-car',
                headers={
                    'Authorization': ORS_API_KEY,
                    'Content-Type': 'application/json'
                },
                json={
                    'coordinates': [
                        [float(o_lon), float(o_lat)],
                        [float(d_lon), float(d_lat)]
                    ]
                },
                timeout=5
            )
            print(f"ORS Response Status: {response.status_code}")
            data = response.json()
            if response.status_code == 200 and 'routes' in data and data['routes']:
                route = data['routes'][0]
                return Response({
                    "geometry": route['geometry'],
                    "distance": route['summary']['distance'],
                    "duration": route['summary']['duration']
                }, status=status.HTTP_200_OK)
            
            # Fallback if ORS fails (Rate Limit 429, etc)
            print(f"ORS Failed (Status {response.status_code}), using fallback.")
            dist_km = haversine_dist(origin, dest)
            # 2 mins per km, 1000m per km
            duration_sec = dist_km * 2.0 * 60
            distance_m = dist_km * 1000

            # Simple encoded polyline for a straight line (two points)
            # This is a very basic "mock" geometry if real routing fails
            return Response({
                "geometry": None, # Frontend handles null geometry
                "distance": distance_m,
                "duration": duration_sec,
                "is_fallback": True
            }, status=status.HTTP_200_OK)

        except Exception as e:
            print(f"RouteGeometryView Exception: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class RatingListView(views.APIView):
    @extend_schema(
        summary="List all ratings of a driver",
        description="Returns all ratings of a driver.",
        responses={200: RatingListSerializer(many=True)}
    )
    def get(self, request, driver_id):
        ratings = Rating.objects.filter(trip__shift__driver__user=driver_id)
        serializer = RatingListSerializer(ratings, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class RatingCreateView(views.APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Rate a trip",
        description="Client rates a trip that he was a passenger in and has been completed.",
        request=RatingCreateSerializer,
        responses={201: RatingListSerializer}
    )
    def post(self, request):
        serializer = RatingCreateSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        
        try:
            #The Serializer already verifies if the trip exist and the client is part of it
            trip = Trip.objects.get(id=data['trip_id'])
        except Trip.DoesNotExist:
            return Response({"error": "Trip not found."}, status=status.HTTP_404_NOT_FOUND)
        
        # Create the rating
        rating = Rating.objects.create(trip=trip, score=data['score'])
        
        response_serializer = RatingListSerializer(rating)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

class TripCancelView(views.APIView):
    @extend_schema(
        summary="Cancel a trip (Client)",
        description="Client cancels a trip. Only possible if status is PENDING or DRIVER_ACCEPTED.",
        request=TripCancelSerializer,
        responses={200: TripListSerializer}
    )
    def patch(self, request, id):
        try:
            trip = Trip.objects.select_related(
                'client__user',
                'shift__driver__user',
                'shift__taxi',
                'interval'
            ).get(id=id)
        except Trip.DoesNotExist:
            return Response({"error": "Trip not found."}, status=status.HTTP_404_NOT_FOUND)
        
        # Só pode cancelar se ainda não estiver em progresso ou completa
        cancelable_statuses = ['PENDING', 'DRIVER_ACCEPTED', 'CLIENT_ACCEPTED']
        if trip.status not in cancelable_statuses:
            return Response(
                {"error": f"Trip cannot be canceled. Current status: {trip.status}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        trip.status = 'CANCELED'
        trip.save()
        
        response_serializer = TripListSerializer(trip)
        return Response(response_serializer.data, status=status.HTTP_200_OK)
    
class TripCompleteView(views.APIView):
    @extend_schema(
        summary="Complete a trip",
        description="Marks trip as COMPLETED and calculates the final price. The invoice is generated only after payment is confirmed.",
        request=None,
        responses={200: TripCompleteSerializer}
    )
    def patch(self, request, id):
        try:
            trip = Trip.objects.select_related(
                'client__user',
                'shift__driver__user',
                'shift__taxi',
                'interval'
            ).get(id=id)
        except Trip.DoesNotExist:
            return Response({"error": "Trip not found."}, status=status.HTTP_404_NOT_FOUND)
        
        if trip.status != 'IN_PROGRESS':
            return Response(
                {"error": f"Trip cannot be completed. Current status: {trip.status}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Fechar o intervalo da viagem
        now = timezone.now()
        trip.interval.end_time = now
        trip.interval.save()

        trip.status = 'WAITING_PAYMENT'
        trip.save()

        response_serializer = TripCompleteSerializer(trip)
        return Response(response_serializer.data, status=status.HTTP_200_OK)


class TripPayMockView(views.APIView):
    @extend_schema(
        summary="Mock trip payment",
        description="Transition trip from WAITING_PAYMENT to COMPLETED.",
        request=None,
        responses={200: TripCompleteSerializer}
    )
    def patch(self, request, id):
        try:
            trip = Trip.objects.get(id=id)
        except Trip.DoesNotExist:
            return Response({"error": "Trip not found."}, status=status.HTTP_404_NOT_FOUND)
        
        if trip.status != 'WAITING_PAYMENT':
            return Response(
                {"error": f"Trip cannot be paid. Current status: {trip.status}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        trip.status = 'COMPLETED'
        trip.save()

        # Optional: create invoice automatically for mock payment
        create_invoice_for_paid_trip(trip)

        response_serializer = TripCompleteSerializer(trip)
        return Response(response_serializer.data, status=status.HTTP_200_OK)


def create_invoice_for_paid_trip(trip):
    existing_invoice = Invoice.objects.filter(trip=trip).first()
    if existing_invoice:
        return existing_invoice, False

    with transaction.atomic():
        existing_invoice = Invoice.objects.select_for_update().filter(trip=trip).first()
        if existing_invoice:
            return existing_invoice, False

        current_year = timezone.now().year
        last_invoice = Invoice.objects.select_for_update().filter(date__year=current_year).order_by('-number').first()
        next_number = (last_invoice.number + 1) if last_invoice else 1

        invoice = Invoice.objects.create(
            trip=trip,
            number=next_number,
            date=timezone.now().date(),
            amount_total=trip.price,
            amount_paid=trip.price,
            nif=trip.client.user.nif
        )

    return invoice, True


class TripPaymentStartView(views.APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Start trip payment with Stripe",
        description="Creates a Stripe Checkout Session for a completed trip and returns the hosted payment URL.",
        request=inline_serializer(
            name='TripPaymentStartRequest',
            fields={
                'success_url': serializers.URLField(required=False),
                'cancel_url': serializers.URLField(required=False),
            }
        ),
        responses={
            200: inline_serializer(
                name='TripPaymentStartResponse',
                fields={
                    'checkout_session_id': serializers.CharField(),
                    'checkout_url': serializers.URLField(),
                    'amount': serializers.DecimalField(max_digits=10, decimal_places=2),
                    'currency': serializers.CharField(),
                }
            ),
            400: inline_serializer(name='TripPaymentStartBadRequest', fields={'error': serializers.CharField()}),
            403: inline_serializer(name='TripPaymentStartForbidden', fields={'error': serializers.CharField()}),
            404: inline_serializer(name='TripPaymentStartNotFound', fields={'error': serializers.CharField()}),
        }
    )
    def post(self, request, id):
        if stripe is None:
            return Response({"error": "Stripe dependency is not installed. Rebuild the backend image after installing requirements."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        stripe_secret_key = os.environ.get('STRIPE_SECRET_KEY')
        if not stripe_secret_key:
            return Response({"error": "STRIPE_SECRET_KEY is not configured."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            trip = Trip.objects.select_related('client__user').get(id=id)
        except Trip.DoesNotExist:
            return Response({"error": "Trip not found."}, status=status.HTTP_404_NOT_FOUND)

        if trip.client.user_id != request.user.id and not Manager.objects.filter(user=request.user).exists():
            return Response({"error": "You can only pay your own trips."}, status=status.HTTP_403_FORBIDDEN)

        if trip.status not in ['COMPLETED', 'WAITING_PAYMENT']:
            return Response({"error": "Only completed or waiting payment trips can be paid."}, status=status.HTTP_400_BAD_REQUEST)

        if trip.price <= 0:
            return Response({"error": "Trip price must be positive."}, status=status.HTTP_400_BAD_REQUEST)

        base_url = request.build_absolute_uri('/').rstrip('/')
        success_url = normalize_checkout_url(
            request.data.get('success_url') or f"{base_url}/payment/success?trip_id={trip.id}&session_id={{CHECKOUT_SESSION_ID}}"
        )
        cancel_url = normalize_checkout_url(
            request.data.get('cancel_url') or f"{base_url}/payment/cancel?trip_id={trip.id}"
        )

        stripe.api_key = stripe_secret_key
        try:
            checkout_session = stripe.checkout.Session.create(
                mode='payment',
                payment_method_types=['card'],
                customer_email=trip.client.user.email,
                success_url=success_url,
                cancel_url=cancel_url,
                metadata={'trip_id': str(trip.id)},
                payment_intent_data={'metadata': {'trip_id': str(trip.id)}},
                line_items=[{
                    'quantity': 1,
                    'price_data': {
                        'currency': STRIPE_CURRENCY,
                        'unit_amount': amount_to_cents(trip.price),
                        'product_data': {
                            'name': f'Tuxy trip #{trip.id}',
                            'description': f'{trip.originAddress} -> {trip.destAddress}',
                        },
                    },
                }],
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_502_BAD_GATEWAY)

        return Response({
            "checkout_session_id": checkout_session.id,
            "checkout_url": checkout_session.url,
            "amount": trip.price,
            "currency": STRIPE_CURRENCY,
        }, status=status.HTTP_200_OK)


class TripPaymentStatusView(views.APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get Stripe payment status for a trip",
        description="Retrieves a Stripe Checkout Session and returns its payment status.",
        responses={200: inline_serializer(
            name='TripPaymentStatusResponse',
            fields={
                'checkout_session_id': serializers.CharField(),
                'payment_status': serializers.CharField(),
                'paid': serializers.BooleanField(),
                'invoice_created': serializers.BooleanField(),
                'invoice_number': serializers.IntegerField(required=False),
            }
        )}
    )
    def get(self, request, id):
        if stripe is None:
            return Response({"error": "Stripe dependency is not installed. Rebuild the backend image after installing requirements."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        stripe_secret_key = os.environ.get('STRIPE_SECRET_KEY')
        if not stripe_secret_key:
            return Response({"error": "STRIPE_SECRET_KEY is not configured."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        session_id = request.query_params.get('session_id')
        if not session_id:
            return Response({"error": "session_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            trip = Trip.objects.select_related('client__user').get(id=id)
        except Trip.DoesNotExist:
            return Response({"error": "Trip not found."}, status=status.HTTP_404_NOT_FOUND)

        if trip.client.user_id != request.user.id and not Manager.objects.filter(user=request.user).exists():
            return Response({"error": "You can only check your own payments."}, status=status.HTTP_403_FORBIDDEN)

        stripe.api_key = stripe_secret_key
        try:
            checkout_session = stripe.checkout.Session.retrieve(session_id)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_502_BAD_GATEWAY)

        if str(checkout_session.metadata.get('trip_id')) != str(trip.id):
            return Response({"error": "Checkout session does not belong to this trip."}, status=status.HTTP_403_FORBIDDEN)

        invoice = None
        invoice_created = False
        if checkout_session.payment_status == 'paid':
            invoice, invoice_created = create_invoice_for_paid_trip(trip)

        return Response({
            "checkout_session_id": checkout_session.id,
            "payment_status": checkout_session.payment_status,
            "paid": checkout_session.payment_status == 'paid',
            "invoice_created": invoice_created,
            "invoice_number": invoice.number if invoice else None,
        }, status=status.HTTP_200_OK)


class StripeWebhookView(views.APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(
        summary="Stripe webhook",
        description="Receives Stripe webhook events. Configure Stripe to send checkout.session.completed here.",
        request=None,
        responses={200: inline_serializer(name='StripeWebhookResponse', fields={'received': serializers.BooleanField()})}
    )
    def post(self, request):
        if stripe is None:
            return Response({"error": "Stripe dependency is not installed."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        webhook_secret = os.environ.get('STRIPE_WEBHOOK_SECRET')
        payload = request.body
        sig_header = request.headers.get('Stripe-Signature')

        try:
            if webhook_secret:
                event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
            else:
                event = stripe.Event.construct_from(request.data, stripe.api_key)
        except ValueError:
            return Response({"error": "Invalid payload."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": f"Invalid Stripe webhook: {e}"}, status=status.HTTP_400_BAD_REQUEST)

        event_type = event.get('type')
        if not event_type:
            return Response({"error": "Invalid Stripe webhook event: missing type."}, status=status.HTTP_400_BAD_REQUEST)

        if event_type == 'checkout.session.completed':
            session = event['data']['object']
            trip_id = session.get('metadata', {}).get('trip_id')
            if trip_id and session.get('payment_status') == 'paid':
                try:
                    trip = Trip.objects.select_related('client__user').get(id=trip_id, status='COMPLETED')
                    create_invoice_for_paid_trip(trip)
                except Trip.DoesNotExist:
                    pass

        return Response({"received": True}, status=status.HTTP_200_OK)


class InvoiceListView(views.APIView):
    @extend_schema(
        summary="List invoices",
        description="Returns all issued invoices, ordered by most recent date and invoice number.",
        responses={200: InvoiceSerializer(many=True)}
    )
    def get(self, request):
        invoices = Invoice.objects.select_related(
            'trip__client__user',
            'trip__shift__driver__user',
            'trip__shift__taxi',
            'trip__interval',
        ).order_by('-date', '-number')

        serializer = InvoiceSerializer(invoices, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class InvoiceDetailView(views.APIView):
    @extend_schema(
        summary="Get invoice details",
        description="Returns one invoice by id. In this schema, the invoice id is the trip id.",
        responses={
            200: InvoiceSerializer,
            404: inline_serializer(name='InvoiceNotFound', fields={'error': serializers.CharField()}),
        }
    )
    def get(self, request, id):
        try:
            invoice = Invoice.objects.select_related(
                'trip__client__user',
                'trip__shift__driver__user',
                'trip__shift__taxi',
                'trip__interval',
            ).get(trip_id=id)
        except Invoice.DoesNotExist:
            return Response({"error": "Invoice not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = InvoiceSerializer(invoice)
        return Response(serializer.data, status=status.HTTP_200_OK)


class TripInvoiceView(views.APIView):
    @extend_schema(
        summary="Get invoice from trip",
        description="Returns the invoice issued for a specific trip.",
        responses={
            200: InvoiceSerializer,
            404: inline_serializer(name='TripInvoiceNotFound', fields={'error': serializers.CharField()}),
        }
    )
    def get(self, request, id):
        try:
            invoice = Invoice.objects.select_related(
                'trip__client__user',
                'trip__shift__driver__user',
                'trip__shift__taxi',
                'trip__interval',
            ).get(trip_id=id)
        except Invoice.DoesNotExist:
            return Response({"error": "Invoice not found for this trip."}, status=status.HTTP_404_NOT_FOUND)

        serializer = InvoiceSerializer(invoice)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ClientInvoiceListView(views.APIView):
    @extend_schema(
        summary="List invoices from a client",
        description="Returns all invoices issued for trips requested by a specific client user ID.",
        responses={
            200: InvoiceSerializer(many=True),
            404: inline_serializer(name='ClientInvoiceClientNotFound', fields={'error': serializers.CharField()}),
        }
    )
    def get(self, request, id):
        if not Client.objects.filter(user__id=id).exists():
            return Response({"error": "Client not found."}, status=status.HTTP_404_NOT_FOUND)

        invoices = Invoice.objects.select_related(
            'trip__client__user',
            'trip__shift__driver__user',
            'trip__shift__taxi',
            'trip__interval',
        ).filter(trip__client__user_id=id).order_by('-date', '-number')

        serializer = InvoiceSerializer(invoices, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    

class RefuelListCreateView(views.APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="List and create refuel records",
        description="Allows drivers to register refuels and list existing refuel records.",
        request=RefuelSerializer,
        responses={200: RefuelSerializer(many=True), 201: RefuelSerializer}
    )
    def get(self, request):
        refuels = Refueling.objects.all().order_by('-created_at')
        serializer = RefuelSerializer(refuels, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = RefuelSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class CheckHealthView(views.APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    
    @extend_schema(
        summary="Health Check",
        description="Returns the status of the API and its database connection.",
        responses={200: inline_serializer(
            name='CheckHealthResponse',
            fields={'status': serializers.CharField(), 'database': serializers.CharField(), 'hostname': serializers.CharField()}
        )}
    )
    def get(self, request):
        health = {
            "status": "OK",
            "hostname": socket.gethostname(),
            "ip": socket.gethostbyname(socket.gethostname()),
            "database": "OK"
        }
        try:
            # Attempt a simple database query to verify connectivity
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
        except Exception as e:
            health["status"] = "ERROR"
            health["database"] = f"Unreachable: {str(e)}"
            return Response(health, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            
        return Response(health, status=status.HTTP_200_OK)
    
class PricingConfigView(views.APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get pricing config",
        description="Returns the current pricing configuration. Accessible to all authenticated users.",
        request=None,
        responses={200: inline_serializer(
            name='PricingConfigResponse',
            fields={
                'base_fare': serializers.FloatField(),
                'price_per_min_basic': serializers.FloatField(),
                'price_per_min_luxury': serializers.FloatField(),
            }
        )}
    )
    def get(self, request):
        return Response({
            'base_fare': PRICING_CONFIG['BASE_FARE'],
            'price_per_min_basic': PRICING_CONFIG['PRICE_PER_MIN_BASIC'],
            'price_per_min_luxury': PRICING_CONFIG['PRICE_PER_MIN_LUXURY'],
        }, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Update pricing config (Manager only)",
        description="Updates the current pricing configuration. All fields are optional.",
        request=inline_serializer(
            name='PricingConfigUpdateRequest',
            fields={
                'base_fare': serializers.FloatField(required=False),
                'price_per_min_basic': serializers.FloatField(required=False),
                'price_per_min_luxury': serializers.FloatField(required=False),
            }
        ),
        responses={200: inline_serializer(
            name='PricingConfigUpdateResponse',
            fields={
                'base_fare': serializers.FloatField(),
                'price_per_min_basic': serializers.FloatField(),
                'price_per_min_luxury': serializers.FloatField(),
            }
        )}
    )
    def patch(self, request):
        if not Manager.objects.filter(user=request.user).exists():
            return Response({"error": "Only managers can update pricing."}, status=status.HTTP_403_FORBIDDEN)

        if 'base_fare' in request.data:
            PRICING_CONFIG['BASE_FARE'] = float(request.data['base_fare'])
        if 'price_per_min_basic' in request.data:
            PRICING_CONFIG['PRICE_PER_MIN_BASIC'] = float(request.data['price_per_min_basic'])
        if 'price_per_min_luxury' in request.data:
            PRICING_CONFIG['PRICE_PER_MIN_LUXURY'] = float(request.data['price_per_min_luxury'])

        return Response({
            'base_fare': PRICING_CONFIG['BASE_FARE'],
            'price_per_min_basic': PRICING_CONFIG['PRICE_PER_MIN_BASIC'],
            'price_per_min_luxury': PRICING_CONFIG['PRICE_PER_MIN_LUXURY'],
        }, status=status.HTTP_200_OK)
