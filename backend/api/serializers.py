import re
from datetime import date
from rest_framework import serializers
from .models import Taxi, TimeInterval, Driver, Client, Trip, Rating, Shift
from django.utils import timezone as tz


#Validators that are commomn to multiple serializers
def validate_password(value):
    if len(value) < 6:
        raise serializers.ValidationError("Password must be at least 6 characters long.")
    if not re.search(r'[A-Za-z]', value):
        raise serializers.ValidationError("Password must contain at least one letter.")
    if not re.search(r'[0-9]', value):
        raise serializers.ValidationError("Password must contain at least one number.")
    return value

def validate_nif(value):
    if not re.match(r'^[1-9][0-9]{8}$', value):
        raise serializers.ValidationError("Invalid NIF format. Must be 9 digits starting with 1-9.")
    return value

class TaxiSerializer(serializers.ModelSerializer):
    class Meta:
        model = Taxi
        fields = '__all__'
class TimeIntervalSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimeInterval
        fields = ['start_time', 'end_time']


#PUT / POST (Should include validations to fail quickly and have informative error messages)
class CreateDriverSerializer(serializers.Serializer):
    nif = serializers.CharField(max_length=12, validators=[validate_nif])
    name = serializers.CharField(max_length=60)
    email = serializers.EmailField(max_length=60)
    gender = serializers.ChoiceField(choices=['Male', 'Female', 'Other'])
    password = serializers.CharField(max_length=40, validators=[validate_password])
    license_number = serializers.CharField(max_length=12)
    birth_year = serializers.CharField(max_length=4)

    def validate_birth_year(self, value):
        try:
            year = int(value)
            current_year = date.today().year
            if year < 1900:
                raise serializers.ValidationError("Birth year must be >= 1900.")
            if current_year - year < 18:
                raise serializers.ValidationError("Driver must be at least 18 years old.")
        except ValueError:
            raise serializers.ValidationError("Invalid year format.")
        return value

class CreateClientSerializer(serializers.Serializer):
    nif = serializers.CharField(max_length=12, validators=[validate_nif])
    name = serializers.CharField(max_length=60)
    email = serializers.EmailField(max_length=60)
    gender = serializers.ChoiceField(choices=['Male', 'Female', 'Other'])
    password = serializers.CharField(max_length=40, validators=[validate_password])

class CreateManagerSerializer(serializers.Serializer):
    nif = serializers.CharField(max_length=12, validators=[validate_nif])
    name = serializers.CharField(max_length=60)
    email = serializers.EmailField(max_length=60)
    gender = serializers.ChoiceField(choices=['Male', 'Female', 'Other'])
    password = serializers.CharField(max_length=40, validators=[validate_password])

class CreateTaxiSerializer(serializers.ModelSerializer):
    license_plate = serializers.CharField(max_length=8)
    purchase_year = serializers.CharField(max_length=4)
    mileage = serializers.IntegerField(min_value=0)
    brand = serializers.CharField(max_length=40)
    model = serializers.CharField(max_length=40)
    comfort_level = serializers.ChoiceField(choices=['basic', 'luxury'])
    engine_type = serializers.ChoiceField(choices=['combustion', 'electric'])
    num_passengers = serializers.IntegerField(min_value=1, max_value=4)

    def validate(self, data):
        if not data.get('brand') or not data.get('model'):
            raise serializers.ValidationError("Brand and model cannot be empty.")
        return data

    class Meta:
        model = Taxi
        fields = ['license_plate', 'purchase_year', 'mileage', 'brand', 'model', 'comfort_level', 'engine_type', 'num_passengers']

class TripCreateSerializer(serializers.Serializer):
    client_id      = serializers.IntegerField()
    originAddress  = serializers.CharField(max_length=255)
    destAddress    = serializers.CharField(max_length=255)
    comfort_level  = serializers.ChoiceField(choices=['basic', 'luxury'])
    num_passengers = serializers.IntegerField(min_value=1, max_value=4)
    scheduled_time = serializers.DateTimeField(required=False, allow_null=True)


    def validate(self, data):
        origin = data.get('originAddress')
        destination = data.get('destAddress')
        
        if origin and destination and origin == destination:
            raise serializers.ValidationError("Origin and destination cannot be the same.")
        
        return data

class ShiftCreateSerializer(serializers.Serializer):
    driver_id          = serializers.IntegerField()
    taxi_license_plate = serializers.CharField(max_length=10)
    start_time         = serializers.DateTimeField()
    end_time           = serializers.DateTimeField()

    def validate(self, data):
        start = data['start_time']
        end = data['end_time']
        if tz.is_naive(start):
            start = tz.make_aware(start)
        if tz.is_naive(end):
            end = tz.make_aware(end)
        data['start_time'] = start
        data['end_time'] = end

        if start >= end:
            raise serializers.ValidationError("start_time must be before end_time.")
        
        delta = end - start
        if delta.total_seconds() / 3600 > 8:
            raise serializers.ValidationError("A scheduled shift cannot last more than 8 hours.")

        if not Driver.objects.filter(pk=data['driver_id']).exists():
            raise serializers.ValidationError("Driver not found.")
            
        taxi = Taxi.objects.filter(license_plate=data['taxi_license_plate']).first()
        if not taxi:
            raise serializers.ValidationError("Taxi not found.")
            
        try:
            purchase_year = int(taxi.purchase_year)
            if purchase_year > start.year:
                raise serializers.ValidationError("The taxi purchase year cannot be later than the shift year.")
        except ValueError:
            pass

        driver_overlap = Shift.objects.filter(
            driver_id=data['driver_id'],
            scheduled_interval__start_time__lt=end,
            scheduled_interval__end_time__gt=start
        ).exists()
        if driver_overlap:
            raise serializers.ValidationError("Driver already has a shift in this time period.")

        taxi_overlap = Shift.objects.filter(
            taxi__license_plate=data['taxi_license_plate'],
            scheduled_interval__start_time__lt=end,
            scheduled_interval__end_time__gt=start
        ).exists()
        if taxi_overlap:
            raise serializers.ValidationError("Taxi is already assigned to a shift in this time period.")
            
        return data

class RatingCreateSerializer(serializers.Serializer):
    trip_id = serializers.IntegerField()
    score = serializers.IntegerField(min_value=1, max_value=5)

    def validate(self, data):
        client_id = self.context['request'].user.id
        trip = Trip.objects.filter(pk=data['trip_id'], client__user__id=client_id).first()

        if not trip:
            raise serializers.ValidationError("Trip not found or does not belong to the client.")

        if Rating.objects.filter(trip=trip).exists():
            raise serializers.ValidationError("A client can only rate a trip once.")

        # RIA: A client can only rate a trip when its status is COMPLETED.
        if trip.status != 'COMPLETED':
            raise serializers.ValidationError("A client can only rate a trip when its status is COMPLETED.")

        return data
#GETS
class UserSerializer(serializers.ModelSerializer):
    id    = serializers.IntegerField(source='user_id', read_only=True)
    nif   = serializers.CharField(source='user.nif',   read_only=True)
    name  = serializers.CharField(source='user.name',  read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    gender = serializers.CharField(source='user.gender', read_only=True)
    is_banned = serializers.BooleanField(source="user.is_banned", read_only=True)

    class Meta:
        model = Client
        fields = ['id', 'nif', 'name', 'email', 'gender', "is_banned"]


class DriverSerializer(serializers.ModelSerializer):
    id    = serializers.IntegerField(source='user_id', read_only=True)
    nif   = serializers.CharField(source='user.nif',   read_only=True)
    name  = serializers.CharField(source='user.name',  read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    gender = serializers.CharField(source='user.gender', read_only=True)
    is_banned = serializers.BooleanField(source="user.is_banned", read_only=True)
    license_number = serializers.CharField(read_only=True)
    birth_year = serializers.CharField(read_only=True)

    class Meta:
        model = Driver
        fields = ['id', 'nif', 'name', 'email', 'gender', 'license_number', 'birth_year', "is_banned"]

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
    driver_name = serializers.CharField(source='shift.driver.user.name', read_only=True, default=None)
    driver_id   = serializers.IntegerField(source='shift.driver.user_id', read_only=True, default=None)
    taxi_plate  = serializers.CharField(source='shift.taxi.license_plate', read_only=True, default=None)
    taxi_brand  = serializers.CharField(source='shift.taxi.brand', read_only=True, default=None)
    taxi_model  = serializers.CharField(source='shift.taxi.model', read_only=True, default=None)
    taxi_engine = serializers.CharField(source='shift.taxi.engine_type', read_only=True, default=None)
    client_id   = serializers.IntegerField(source='client.user_id', read_only=True)
    client_name = serializers.CharField(source='client.user.name', read_only=True)
    interval    = TimeIntervalSerializer(read_only=True)

    class Meta:
        model = Trip    
        fields = ['id', 'status', 'originCoords', 'destCoords', 'originAddress', 'destAddress', 'comfort_level', 'num_passengers', 'kilometers', 'price', 'client_id', 'client_name', 'driver_id', 'driver_name', 'taxi_plate', 'taxi_brand', 'taxi_model', 'taxi_engine', 'interval']

class ShiftDetailSerializer(serializers.ModelSerializer):
    driver_id          = serializers.IntegerField(source='driver.user_id', read_only=True)
    driver_name        = serializers.CharField(source='driver.user.name', read_only=True)
    taxi_plate         = serializers.CharField(source='taxi.license_plate', read_only=True)
    scheduled_interval = TimeIntervalSerializer(read_only=True)
    real_interval      = TimeIntervalSerializer(read_only=True)

    class Meta:
        model = Shift
        fields = ['id', 'driver_id', 'driver_name', 'taxi_plate', 'scheduled_interval', 'real_interval']

class RatingListSerializer(serializers.ModelSerializer):
    trip_id = serializers.IntegerField(source='trip.id', read_only=True)
    score = serializers.IntegerField(read_only=True)

    class Meta:
        model = Rating
        fields = ['trip_id', 'score']

#PATCH 
class TripAcceptSerializer(serializers.Serializer):
    shift_id  = serializers.IntegerField(required=False)

    def validate_driver_id(self, value):
        if not Driver.objects.filter(user__id=value).exists():
            raise serializers.ValidationError("Driver not found.")
        return value

    def validate_shift_id(self, value):
        if not Shift.objects.filter(id=value).exists():
            raise serializers.ValidationError("Shift not found.")
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
        fields = ['id', 'status', 'originCoords', 'destCoords', 'originAddress', 'destAddress', 'comfort_level', 'num_passengers', 'kilometers', 'price', 'client_name', 'driver_name', 'taxi_plate', 'interval']