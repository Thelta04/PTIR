from rest_framework import serializers
from .models import *

class TaxiSerializer(serializers.ModelSerializer):
    class Meta:
        model = Taxi
        fields = '__all__'
class TimeIntervalSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimeInterval
        fields = ['start_time', 'end_time']


#PUT / POST

class CreateDriverSerializer(serializers.Serializer):
    nif = serializers.CharField(max_length=12)
    name = serializers.CharField(max_length=60)
    email = serializers.EmailField(max_length=60)
    gender = serializers.CharField(max_length=15)
    password = serializers.CharField(max_length=40)
    license_number = serializers.CharField(max_length=12)
    birth_year = serializers.CharField(max_length=4)

class CreateClientSerializer(serializers.Serializer):
    nif = serializers.CharField(max_length=12)
    name = serializers.CharField(max_length=60)
    email = serializers.EmailField(max_length=60)
    gender = serializers.CharField(max_length=15)
    password = serializers.CharField(max_length=40)

class CreateManagerSerializer(serializers.Serializer):
    nif = serializers.CharField(max_length=12)
    name = serializers.CharField(max_length=60)
    email = serializers.EmailField(max_length=60)
    gender = serializers.CharField(max_length=15)
    password = serializers.CharField(max_length=40)

class CreateTaxiSerializer(serializers.ModelSerializer):
    license_plate = serializers.CharField(max_length=8)
    purchase_year = serializers.CharField(max_length=4)
    mileage = serializers.IntegerField()
    brand = serializers.CharField(max_length=40)
    model = serializers.CharField(max_length=40)
    comfort_level = serializers.CharField(max_length=10)
    engine_type = serializers.CharField(max_length=40)
    num_passengers = serializers.IntegerField()

    def validate_comfort_level(self, value):
        if value not in ['basic', 'luxury']:
            raise serializers.ValidationError("Comfort level must be 'basic' or 'luxury'.")
        return value
    
    class Meta:
        model = Taxi
        fields = ['license_plate', 'purchase_year', 'mileage', 'brand', 'model', 'comfort_level', 'engine_type', 'num_passengers']

class TripCreateSerializer(serializers.Serializer):
    client_id      = serializers.IntegerField()
    shift_id       = serializers.IntegerField()
    origin         = serializers.CharField(max_length=255)
    destination    = serializers.CharField(max_length=255)
    comfort_level  = serializers.ChoiceField(choices=['basic', 'luxury'])
    num_passengers = serializers.IntegerField(min_value=1, max_value=4)
    start_time     = serializers.DateTimeField()
    end_time       = serializers.DateTimeField()

    def validate(self, data):
        # RIA: origem != destino
        if data['origin'] == data['destination']:
            raise serializers.ValidationError("Origem e destino não podem ser iguais.")
        
        # RIA: intervalo válido
        if data['start_time'] >= data['end_time']:
            raise serializers.ValidationError("start_time deve ser anterior a end_time.")
        
        # Validar se o client existe
        if not Client.objects.filter(user__id=data['client_id']).exists():
            raise serializers.ValidationError("Cliente não encontrado.")
        
        # Validar se o shift existe
        if not Shift.objects.filter(id=data['shift_id']).exists():
            raise serializers.ValidationError("Turno não encontrado.")
        
        return data

class ShiftCreateSerializer(serializers.Serializer):
    driver_id          = serializers.IntegerField()
    taxi_license_plate = serializers.CharField(max_length=10)
    start_time         = serializers.DateTimeField()
    end_time           = serializers.DateTimeField()

    def validate(self, data):
        if data['start_time'] >= data['end_time']:
            raise serializers.ValidationError("start_time must be before end_time.")
        if not Driver.objects.filter(pk=data['driver_id']).exists():
            raise serializers.ValidationError("Driver not found.")
        if not Taxi.objects.filter(license_plate=data['taxi_license_plate']).exists():
            raise serializers.ValidationError("Taxi not found.")
        return data

class ShiftDetailSerializer(serializers.ModelSerializer):
    driver_id          = serializers.IntegerField(source='driver.user_id', read_only=True)
    driver_name        = serializers.CharField(source='driver.user.name', read_only=True)
    taxi_plate         = serializers.CharField(source='taxi.license_plate', read_only=True)
    scheduled_interval = TimeIntervalSerializer(read_only=True)
    real_interval      = TimeIntervalSerializer(read_only=True)

    class Meta:
        model = Shift
        fields = ['id', 'driver_id', 'driver_name', 'taxi_plate', 'scheduled_interval', 'real_interval']

#GETS
class UserSerializer(serializers.ModelSerializer):
    nif   = serializers.CharField(source='user.nif',   read_only=True)
    name  = serializers.CharField(source='user.name',  read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    gender = serializers.CharField(source='user.gender', read_only=True)
    is_banned = serializers.BooleanField(source="user.is_banned", read_only=True)

    class Meta:
        model = Client
        fields = ['nif', 'name', 'email', 'gender', "is_banned"]


class DriverSerializer(serializers.ModelSerializer):
    nif   = serializers.CharField(source='user.nif',   read_only=True)
    name  = serializers.CharField(source='user.name',  read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    gender = serializers.CharField(source='user.gender', read_only=True)
    is_banned = serializers.BooleanField(source="user.is_banned", read_only=True)
    license_number = serializers.CharField(read_only=True)
    birth_year = serializers.CharField(read_only=True)

    class Meta:
        model = Driver
        fields = ['nif', 'name', 'email', 'gender', 'license_number', 'birth_year', "is_banned"]

class TaxiDetailSerializer(serializers.ModelSerializer):
    license_plate = serializers.CharField(read_only=True)
    purchase_year = serializers.CharField(read_only=True)
    mileage = serializers.IntegerField(read_only=True)
    brand = serializers.CharField(read_only=True)
    model = serializers.CharField(read_only=True)
    comfort_level = serializers.CharField(read_only=True)
    engine_type = serializers.CharField(read_only=True)
    num_passengers = serializers.IntegerField(read_only=True)

    class Meta:
        model = Taxi
        fields = ['license_plate', 'purchase_year', 'mileage', 'brand', 'model', 'comfort_level', 'engine_type', 'num_passengers']

class TripListSerializer(serializers.ModelSerializer):
    driver_name = serializers.CharField(source='shift.driver.user.name', read_only=True)
    driver_id   = serializers.IntegerField(source='shift.driver.user_id', read_only=True)
    taxi_plate  = serializers.CharField(source='shift.taxi.license_plate', read_only=True)
    client_id   = serializers.IntegerField(source='client.user_id', read_only=True)
    client_name = serializers.CharField(source='client.user.name', read_only=True)
    interval    = TimeIntervalSerializer(read_only=True)

    class Meta:
        model = Trip    
        fields = ['id', 'status', 'origin', 'destination', 'comfort_level', 'num_passengers', 'kilometers', 'price', 'client_id', 'client_name', 'driver_id', 'driver_name', 'taxi_plate', 'interval']
        

#PATCH 
class TripAcceptSerializer(serializers.Serializer):
    driver_id = serializers.IntegerField()
    def validate_driver_id(self, value):
        if not Driver.objects.filter(user__id=value).exists():
            raise serializers.ValidationError("Motorista não encontrado.")
        return value

class TripCancelSerializer(serializers.Serializer):
    # Sem body obrigatório — apenas valida que a viagem pode ser cancelada (feito na view)
    reason = serializers.CharField(max_length=255, required=False, allow_blank=True)

class TripCompleteSerializer(serializers.ModelSerializer):
    driver_name  = serializers.CharField(source='shift.driver.user.name', read_only=True)
    taxi_plate   = serializers.CharField(source='shift.taxi.license_plate', read_only=True)
    client_name  = serializers.CharField(source='client.user.name', read_only=True)
    interval     = TimeIntervalSerializer(read_only=True)

    class Meta:
        model = Trip
        fields = ['id', 'status', 'origin', 'destination', 'comfort_level', 'num_passengers', 'kilometers', 'price', 'client_name', 'driver_name', 'taxi_plate', 'interval']