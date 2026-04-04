from rest_framework import serializers
from .models import *

class TaxiSerializer(serializers.ModelSerializer):
    class Meta:
        model = Taxi
        fields = '__all__'

#PUT / POST

class RegisterDriverSerializer(serializers.Serializer):
    nif = serializers.CharField(max_length=12)
    name = serializers.CharField(max_length=60)
    email = serializers.EmailField(max_length=60)
    gender = serializers.CharField(max_length=15)
    password = serializers.CharField(max_length=40)
    license_number = serializers.CharField(max_length=12)
    birth_year = serializers.CharField(max_length=4)

class RegisterClientSerializer(serializers.Serializer):
    nif = serializers.CharField(max_length=12)
    name = serializers.CharField(max_length=60)
    email = serializers.EmailField(max_length=60)
    gender = serializers.CharField(max_length=15)
    password = serializers.CharField(max_length=40)

class RegisterManagerSerializer(serializers.Serializer):
    nif = serializers.CharField(max_length=12)
    name = serializers.CharField(max_length=60)
    email = serializers.EmailField(max_length=60)
    gender = serializers.CharField(max_length=15)
    password = serializers.CharField(max_length=40)

class RegisterTaxiSerializer(serializers.ModelSerializer):
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