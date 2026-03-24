from rest_framework import serializers
from .models import *

class TaxiSerializer(serializers.ModelSerializer):
    class Meta:
        model = Taxi
        fields = '__all__'

#PUT

class RegistoDriverSerializer(serializers.Serializer):
    nif = serializers.CharField(max_length=12)
    nome = serializers.CharField(max_length=60)
    email = serializers.EmailField(max_length=60)
    genero = serializers.CharField(max_length=15)
    senha = serializers.CharField(max_length=40)
    carta_conducao = serializers.CharField(max_length=12)
    ano_nascimento = serializers.CharField(max_length=4)

class RegistoClientSerializer(serializers.Serializer):
    nif = serializers.CharField(max_length=12)
    nome = serializers.CharField(max_length=60)
    email = serializers.EmailField(max_length=60)
    genero = serializers.CharField(max_length=15)
    senha = serializers.CharField(max_length=40)

class RegistoManagerSerializer(serializers.Serializer):
    nif = serializers.CharField(max_length=12)
    nome = serializers.CharField(max_length=60)
    email = serializers.EmailField(max_length=60)
    genero = serializers.CharField(max_length=15)
    senha = serializers.CharField(max_length=40)


#GETS

class UtilizadorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Utilizador
        fields = ['id', 'nif', 'nome', 'email', 'genero']


class ClienteSerializer(serializers.ModelSerializer):
    nif   = serializers.CharField(source='id_user.nif',   read_only=True)
    nome  = serializers.CharField(source='id_user.nome',  read_only=True)
    email = serializers.CharField(source='id_user.email', read_only=True)
    genero = serializers.CharField(source='id_user.genero', read_only=True)
    is_banned = serializers.BooleanField(source= "id_user.is_banned", read_only = True)

    class Meta:
        model = Cliente
        fields = ['nif', 'nome', 'email', 'genero', "is_banned"]


class MotoristaSerializer(serializers.ModelSerializer):
    nif   = serializers.CharField(source='id_user.nif',   read_only=True)
    nome  = serializers.CharField(source='id_user.nome',  read_only=True)
    email = serializers.CharField(source='id_user.email', read_only=True)
    genero = serializers.CharField(source='id_user.genero', read_only=True)
    is_banned = serializers.BooleanField(source="id_user.is_banned", read_only = True)
    carta_conducao = serializers.CharField(read_only=True)
    ano_nascimento = serializers.CharField(read_only=True)

    class Meta:
        model = Motorista
        fields = ['nif', 'nome', 'email', 'genero', 'carta_conducao', 'ano_nascimento', "is_banned"]