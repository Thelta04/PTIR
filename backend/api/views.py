import math
import socket
import requests

from django.db import connection, transaction
from django.utils import timezone
from rest_framework import views, status, serializers
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
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
        }

        access, refresh = generate_tokens(user)
        response_data["access"] = access
        response_data["refresh"] = refresh

        return Response(response_data, status=status.HTTP_200_OK)
    
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

def calculate_route_summary(origin_coords: str, dest_coords: str) -> tuple[float, float]:
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
        data = response.json()
        summary = data['routes'][0]['summary']
        distance_km = round(summary['distance'] / 1000, 2)
        duration_minutes = round(summary['duration'] / 60, 2)
        return distance_km, duration_minutes
    except Exception:
        return 0, 0

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

        origin_coords = geocode_address(data['originAddress'])
        dest_coords = geocode_address(data['destAddress'])
        
        kilometers = 0
        estimated_minutes = 0
        if origin_coords and dest_coords:
            kilometers, estimated_minutes = calculate_route_summary(origin_coords, dest_coords)

        trip_time = data.get('scheduled_time') or timezone.now()
        estimated_price = calculate_price(estimated_minutes, data['comfort_level'], trip_time) if estimated_minutes > 0 else 0

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
            kilometers=int(round(kilometers)),
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
            data = response.json()
            if 'routes' not in data or not data['routes']:
                 return Response({"error": "No route found"}, status=status.HTTP_404_NOT_FOUND)
                 
            route = data['routes'][0]
            return Response({
                "geometry": route['geometry'],
                "distance": route['summary']['distance'],
                "duration": route['summary']['duration']
            }, status=status.HTTP_200_OK)
        except Exception as e:
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
        summary="Complete a trip and generate invoice",
        description="Marks trip as COMPLETED, calculates final price and generates an invoice.",
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
        
        # Calcular duração em minutos e preço final
        now = timezone.now()
        start_time = trip.interval.start_time
        if timezone.is_naive(start_time):
            start_time = timezone.make_aware(start_time)
            
        minutes = (now - start_time).total_seconds() / 60
        trip.price = calculate_price(minutes, trip.comfort_level, start_time)

        # Fechar o intervalo da viagem
        trip.interval.end_time = now
        trip.interval.save()

        trip.status = 'COMPLETED'
        trip.interval.end_time = now
        trip.interval.save()
        trip.save()
        
        current_year = timezone.now().year
        last_invoice = Invoice.objects.filter(date__year=current_year).order_by('-number').first()
        next_number = (last_invoice.number + 1) if last_invoice else 1
        
        Invoice.objects.create(
            trip=trip,
            number=next_number,
            date=timezone.now().date(),
            amount_total=trip.price,
            amount_paid=trip.price,
            nif=trip.client.user.nif
        )
        
        response_serializer = TripCompleteSerializer(trip)
        return Response(response_serializer.data, status=status.HTTP_200_OK)
    

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
    permission_classes = [IsManager]

    @extend_schema(
        summary="Get pricing config (Manager only)",
        description="Returns the current pricing configuration.",
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
