from rest_framework import generics, views, status
from rest_framework.response import Response
from .models import Taxi, UserAccount, Client, Driver, Manager
from .serializers import *
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers

# --- Views with Business Logic ---

class ClientCreateView(views.APIView):
    @extend_schema(
        summary="Register a new Client",
        description="Creates the base user and immediately associates the Client profile.",
        request=RegisterClientSerializer,
        responses={201: inline_serializer(
            name='ClientCreateResponse',
            fields={'message': serializers.CharField(), 'id': serializers.IntegerField()}
        )}
    )
    def post(self, request):
        serializer = RegisterClientSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data
            
            # 1. Create the base User
            user = UserAccount.objects.create(
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
            user = UserAccount.objects.get(pk=id)
            client = Client.objects.get(user=user)
        except UserAccount.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        except Client.DoesNotExist:
            return Response({"error": "Client not found"}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = UserSerializer(client)
        return Response(serializer.data, status=status.HTTP_200_OK)

class DriverCreateView(views.APIView):
    @extend_schema(
        summary="Register a new Driver",
        description="Creates the base user, client profile, and associates the license number and birth year to the Driver profile.",
        request=RegisterDriverSerializer,
        responses={201: inline_serializer(
            name='DriverCreateResponse',
            fields={'message': serializers.CharField(), 'id': serializers.IntegerField()}
        )}
    )
    def post(self, request):
        serializer = RegisterDriverSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data
            
            user = UserAccount.objects.create(
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
            user = UserAccount.objects.get(pk=id)
            driver = Driver.objects.get(user=user)
        except UserAccount.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        except Driver.DoesNotExist:
            return Response({"error": "Driver not found"}, status=status.HTTP_404_NOT_FOUND)

        # 2. Serialize and return the data
        from .serializers import DriverSerializer
        serializer = DriverSerializer(driver)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ManagerCreateView(views.APIView):
    @extend_schema(
        summary="Register a new Manager",
        description="Creates the base user and associates the Manager profile.",
        request=RegisterManagerSerializer,
        responses={201: inline_serializer(
            name='ManagerCreateResponse',
            fields={'message': serializers.CharField(), 'id': serializers.IntegerField()}
        )}
    )
    def post(self, request):
        serializer = RegisterManagerSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data
            
            user = UserAccount.objects.create(
                nif=data['nif'], name=data['name'], email=data['email'],
                gender=data['gender'], password=data['password']
            )
            Manager.objects.create(user=user)
            
            return Response({"message": "Manager created successfully!", "id": user.id}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class TaxiCreateView(views.APIView):
    @extend_schema(
        summary="Register a new Taxi (Manager only)",
        description="Adds a new vehicle to the fleet. Requires the 'X-User-ID' header with a valid Manager ID.",
        request=RegisterTaxiSerializer,
        responses={201: inline_serializer(
            name='TaxiCreateResponse',
            fields={'message': serializers.CharField(), 'license_plate': serializers.CharField()}
        )}
    )
    def post(self, request):
        user_id = request.headers.get('X-User-ID')
        
        if not user_id:
            return Response({"error": "Access denied. Missing identification (X-User-ID)."}, status=status.HTTP_401_UNAUTHORIZED)
            
        try:
            user = UserAccount.objects.get(id=user_id)
            # Check if the requester exists in the Manager table
            if not Manager.objects.filter(user=user).exists():
                return Response(
                    {"error": "Forbidden. Only Managers can add vehicles to the fleet."}, 
                    status=status.HTTP_403_FORBIDDEN
                )
        except UserAccount.DoesNotExist:
            return Response({"error": "Invalid or unknown user."}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = RegisterTaxiSerializer(data=request.data)
        
        if serializer.is_valid():
            serializer.save()
            
            return Response({
                "message": "Taxi registered successfully in the fleet!",
                "license_plate": serializer.data['license_plate']
            }, status=status.HTTP_201_CREATED)
            
        # If there are errors (e.g. invalid comfort level, duplicate plate)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class TaxiDetailView(views.APIView):
    @extend_schema(
        summary="Get Taxi details",
        description="Returns the detailed information of a specific taxi based on its license plate.",
        responses={200: TaxiDetailSerializer}
    )
    def get(self, request, license_plate):
        try:
            taxi = Taxi.objects.get(license_plate=license_plate)
        except Taxi.DoesNotExist:
            return Response({"error": "Taxi not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = TaxiDetailSerializer(taxi)
        return Response(serializer.data, status=status.HTTP_200_OK)

class LoginView(views.APIView):
    @extend_schema(
        summary="Login",
        description="Validates the user credentials and returns the access profile type (Manager, Driver, Client).",
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
                'type': serializers.CharField()
            }
        )}
    )
    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        if not email or not password:
            return Response({"error": "Email and password are required."},status=status.HTTP_400_BAD_REQUEST
        )
        try:
            user = UserAccount.objects.get(email=email, password=password)
        except UserAccount.DoesNotExist:
            return Response({"error": "Invalid credentials."},status=status.HTTP_401_UNAUTHORIZED
            )
        # Check if banned
        if user.is_banned:
            return Response(
                {"error": "Account suspended."},
                status=status.HTTP_403_FORBIDDEN
            )
        # Determine the user type
        user_type = None
        if Client.objects.filter(user=user).exists():
            user_type = "CLIENT"
        elif Driver.objects.filter(user=user).exists():
            user_type = "DRIVER"
        elif Manager.objects.filter(user=user).exists():
            user_type = "MANAGER"
        else:
            return Response({"error": "User has no associated profile."},status=status.HTTP_403_FORBIDDEN
            )
        return Response({"message": "Login successful!","id": user.id,"name": user.name,"email": user.email,"type": user_type
        }, status=status.HTTP_200_OK)
    
class BanView(views.APIView):
    @extend_schema(
        summary="Ban or Activate User",
        description="Toggles the suspension state (is_banned) of an account. No body data required.",
        request=None,
        responses={200: inline_serializer(
            name='BanToggleResponse',
            fields={'message': serializers.CharField()}
        )}
    )
    def patch(self, request, id):
        # This route uses PATCH because we're updating only 1 field (is_banned)
        try:
            user = UserAccount.objects.get(id=id)
            
            # Toggle the current state (True becomes False, and vice-versa)
            user.is_banned = not user.is_banned 
            user.save()
            
            status_text = "Banned" if user.is_banned else "Active"
            return Response({"message": status_text}, status=status.HTTP_200_OK)
            
        except UserAccount.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)