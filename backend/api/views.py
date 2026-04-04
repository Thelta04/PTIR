from rest_framework import generics, views, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from .models import Taxi, User, Client, Driver, Manager, Shift, TimeInterval, Trip
from .serializers import *
from .authentication import JWTAuthentication, IsManager, generate_tokens, decode_token
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from django.db import transaction
 
# --- Views with Business Logic ---

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
            
            # 1. Create the base User
            user = User.objects.create(
                nif=data['nif'], name=data['name'], email=data['email'],
                gender=data['gender'], password=data['password']
            )
            # 2. Create the Client profile
            Client.objects.create(user=user)
            
            return Response({"message": "Client created successfully!", "id": user.id}, status=status.HTTP_201_CREATED)
        
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
            # 1. Find the user by id
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
        from .serializers import UserSerializer
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
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class DriverDetailView(views.APIView):
    @extend_schema(
        summary="Get Driver details",
        description="Returns the detailed information of a specific driver based on the user ID.",
    )
    def get(self, request, id):
        try:
            # 1. Find the user by id
            user = User.objects.get(pk=id)
            driver = Driver.objects.get(user=user)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        except Driver.DoesNotExist:
            return Response({"error": "Driver not found"}, status=status.HTTP_404_NOT_FOUND)

        # 2. Serialize and return the data
        from .serializers import DriverSerializer
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
        from .serializers import DriverSerializer
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
            
            user = User.objects.create(
                nif=data['nif'], name=data['name'], email=data['email'],
                gender=data['gender'], password=data['password']
            )
            Manager.objects.create(user=user)
            
            return Response({"message": "Manager created successfully!", "id": user.id}, status=status.HTTP_201_CREATED)
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

class ShiftCreateView(views.APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsManager]

    @extend_schema(
        summary="Create a new Shift (Manager only)",
        description="Creates a new shift for a driver and a taxi within a specific time interval. Requires a valid Manager JWT token.",
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
            
            driver = Driver.objects.get(pk=data['driver_id'])
            taxi = Taxi.objects.get(license_plate=data['taxi_license_plate'])

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
    permission_classes = [IsManager]

    @extend_schema(
        summary="Delete a Shift (Manager only)",
        description="Deletes a scheduled shift. Only possible if the shift has not started and has no trips. Requires a valid Manager JWT token.",
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
            if shift.real_interval is not None:
                 return Response({"error": "Cannot delete a shift that has already started."}, status=status.HTTP_403_FORBIDDEN)
            if Trip.objects.filter(shift=shift).exists():
                return Response({"error": "Cannot delete a shift that has associated trips."}, status=status.HTTP_403_FORBIDDEN)
            shift.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Shift.DoesNotExist:
            return Response({"error": "Shift not found."}, status=status.HTTP_404_NOT_FOUND)

class ShiftStartView(views.APIView):
    @extend_schema(
        summary="Start a shift (Clock-in)",
        description="Driver starts a shift.",
        responses={200: inline_serializer(name='ShiftStartResponse', fields={'message': serializers.CharField()})}
    )
    def patch(self, request, id):
        try:
            shift = Shift.objects.get(pk=id)
        except Shift.DoesNotExist:
            return Response({"error": "Shift not found."}, status=status.HTTP_404_NOT_FOUND)
        
        if shift.real_interval is not None:
            return Response({"error": "Shift has already started."}, status=status.HTTP_400_BAD_REQUEST)
        
        from django.utils import timezone
        
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
            
        from django.utils import timezone
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

        # Only managers receive JWT tokens
        if user_type == "MANAGER":
            access, refresh = generate_tokens(user)
            response_data["access"] = access
            response_data["refresh"] = refresh

        return Response(response_data, status=status.HTTP_200_OK)
    
class BanView(views.APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsManager]

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
        description="Returns all trips. Can be filtered by status.",
        responses={200: TripListSerializer(many=True)}
    )
    def get(self, request):
        status_filter = request.query_params.get('status', None)
        
        trips = Trip.objects.select_related(
            'client__user',
            'shift__driver__user',
            'shift__taxi',
            'interval'
        ).all()
        
        if status_filter:
            trips = trips.filter(status=status_filter)
        
        serializer = TripListSerializer(trips, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class TripCreateView(views.APIView):
    @extend_schema(
        summary="Create a new trip (Client)",
        description="Client requests a new trip. Creates a TimeInterval and associates it with the trip.",
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
            shift  = Shift.objects.get(id=data['shift_id'])
        except Client.DoesNotExist:
            return Response({"error": "Client not found."}, status=status.HTTP_404_NOT_FOUND)
        except Shift.DoesNotExist:
            return Response({"error": "Shift not found."}, status=status.HTTP_404_NOT_FOUND)
        
        # 1. Criar o TimeInterval para a viagem
        interval = TimeInterval.objects.create(
            start_time=data['start_time'],
            end_time=data['end_time']
        )
        
        # 2. Criar a Trip
        trip = Trip.objects.create(client=client,
            shift=shift,
            interval=interval,
            origin=data['origin'],
            destination=data['destination'],
            comfort_level=data['comfort_level'],
            num_passengers=data['num_passengers'],
            kilometers=0,   # ainda não conhecido no momento do pedido
            price=0,        # ainda não conhecido no momento do pedido
            status='PENDING'
        )
        
        response_serializer = TripListSerializer(trip)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class TripAcceptView(views.APIView):
    @extend_schema(
        summary="Driver accepts a trip",
        description="Changes trip status from PENDING to DRIVER_ACCEPTED.",
        request=TripAcceptSerializer,
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
        
        # Validar que o estado atual permite aceitar
        if trip.status != 'PENDING':
            return Response(
                {"error": f"Trip cannot be accepted. Current status: {trip.status}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = TripAcceptSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        # Validar que o driver pertence ao shift da viagem
        driver_id = serializer.validated_data['driver_id']
        if trip.shift.driver.user_id != driver_id:
            return Response(
                {"error": "This driver is not assigned to this trip's shift."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        trip.status = 'DRIVER_ACCEPTED'
        trip.save()
        
        response_serializer = TripListSerializer(trip)
        return Response(response_serializer.data, status=status.HTTP_200_OK)
    

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
        
        # Só pode completar se estiver IN_PROGRESS
        if trip.status != 'IN_PROGRESS':
            return Response(
                {"error": f"Trip cannot be completed. Current status: {trip.status}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Atualizar estado
        trip.status = 'COMPLETED'
        trip.save()
        
        # Gerar fatura
        # Buscar o último número de fatura do ano atual para incrementar
        from django.utils import timezone
        current_year = timezone.now().year
        last_invoice = Invoice.objects.filter(date__year=current_year).order_by('-number').first()
        next_number  = (last_invoice.number + 1) if last_invoice else 1
        
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
