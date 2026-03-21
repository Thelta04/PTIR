from rest_framework import generics, views, status
from rest_framework.response import Response
from .models import Taxi, Utilizador, Cliente, Motorista, Gestor
from .serializers import (
    TaxiSerializer, 
    RegistoClienteSerializer, 
    RegistoMotoristaSerializer, 
    RegistoGestorSerializer
)

# A Vista do Táxi mantém-se igual, pois é direta (1 tabela)
class TaxiListCreateView(generics.ListCreateAPIView):
    queryset = Taxi.objects.all()
    serializer_class = TaxiSerializer

# --- Vistas com Lógica de Negócio ---

class ClienteCreateView(views.APIView):
    def post(self, request):
        serializer = RegistoClienteSerializer(data=request.data)
        if serializer.is_valid():
            dados = serializer.validated_data
            
            # 1. Cria o Utilizador Base
            user = Utilizador.objects.create(
                nif=dados['nif'], nome=dados['nome'], email=dados['email'],
                genero=dados['genero'], senha=dados['senha']
            )
            # 2. Cria o perfil de Cliente
            Cliente.objects.create(id_user=user)
            
            return Response({"mensagem": "Cliente criado com sucesso!", "id": user.id}, status=status.HTTP_201_CREATED)
        
        # Se falhar a validação (ex: faltar o email), devolve erro 400 automaticamente
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# class ClienteDetailView(views.APIView):
#     def get(self, request, id):
#         try:
#             # 1. Busca o utilizador pelo id
#             user = Utilizador.objects.get(pk=id)
#             cliente = Cliente.objects.get(id_user=user)
#         except Utilizador.DoesNotExist:
#             return Response({"erro": "Utilizador não encontrado"}, status=status.HTTP_404_NOT_FOUND)
#         except Cliente.DoesNotExist:
#             return Response({"erro": "Cliente não encontrado"}, status=status.HTTP_404_NOT_FOUND)

#         # 2. Serializa e devolve os dados
#         serializer = RegistoClienteSerializer(user)
#         return Response(serializer.data, status=status.HTTP_200_OK)

class MotoristaCreateView(views.APIView):
    def post(self, request):
        serializer = RegistoMotoristaSerializer(data=request.data)
        if serializer.is_valid():
            dados = serializer.validated_data
            
            user = Utilizador.objects.create(
                nif=dados['nif'], nome=dados['nome'], email=dados['email'],
                genero=dados['genero'], senha=dados['senha']
            )
            Motorista.objects.create(
                id_user=user, 
                carta_conducao=dados['carta_conducao'], 
                ano_nascimento=dados['ano_nascimento']
            )
            
            return Response({"mensagem": "Motorista criado com sucesso!", "id": user.id}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class GestorCreateView(views.APIView):
    def post(self, request):
        serializer = RegistoGestorSerializer(data=request.data)
        if serializer.is_valid():
            dados = serializer.validated_data
            
            user = Utilizador.objects.create(
                nif=dados['nif'], nome=dados['nome'], email=dados['email'],
                genero=dados['genero'], senha=dados['senha']
            )
            Gestor.objects.create(id_user=user)
            
            return Response({"mensagem": "Gestor criado com sucesso!", "id": user.id}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)