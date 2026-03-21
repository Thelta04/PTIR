from rest_framework import serializers
from .models import Taxi

class TaxiSerializer(serializers.ModelSerializer):
    class Meta:
        model = Taxi
        fields = '__all__'

class RegistoMotoristaSerializer(serializers.Serializer):
    nif = serializers.CharField(max_length=12)
    nome = serializers.CharField(max_length=60)
    email = serializers.EmailField(max_length=60)
    genero = serializers.CharField(max_length=15)
    senha = serializers.CharField(max_length=40)
    carta_conducao = serializers.CharField(max_length=12)
    ano_nascimento = serializers.CharField(max_length=4)

class RegistoClienteSerializer(serializers.Serializer):
    nif = serializers.CharField(max_length=12)
    nome = serializers.CharField(max_length=60)
    email = serializers.EmailField(max_length=60)
    genero = serializers.CharField(max_length=15)
    senha = serializers.CharField(max_length=40)

class RegistoGestorSerializer(serializers.Serializer):
    nif = serializers.CharField(max_length=12)
    nome = serializers.CharField(max_length=60)
    email = serializers.EmailField(max_length=60)
    genero = serializers.CharField(max_length=15)
    senha = serializers.CharField(max_length=40)