from rest_framework import generics, views, status
from rest_framework.response import Response
from .models import Taxi, Utilizador, Cliente, Motorista, Gestor
from .serializers import *
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers

# A Vista do Táxi mantém-se igual, pois é direta (1 tabela)
# Como herda de ListCreateAPIView e tem um serializer_class, o Swagger já a lê automaticamente!
class TaxiListCreateView(generics.ListCreateAPIView):
    queryset = Taxi.objects.all()
    serializer_class = TaxiSerializer

# --- Vistas com Lógica de Negócio ---

class ClientCreateView(views.APIView):
    @extend_schema(
        summary="Registar um novo Cliente",
        description="Cria o utilizador base e associa-lhe imediatamente o perfil de Cliente.",
        request=RegistoClientSerializer,
        responses={201: inline_serializer(
            name='ClientCreateResponse',
            fields={'mensagem': serializers.CharField(), 'id': serializers.IntegerField()}
        )}
    )
    def post(self, request):
        serializer = RegistoClientSerializer(data=request.data)
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

class ClientDetailView(views.APIView):
    @extend_schema(
        summary="Consultar dados do Cliente",
        description="Devolve a informação detalhada de um cliente específico com base no ID do utilizador.",
        responses={200: ClienteSerializer}
    )
    def get(self, request, id):
        try:
            # 1. Busca o utilizador pelo id
            user = Utilizador.objects.get(pk=id)
            client = Cliente.objects.get(id_user=user)
        except Utilizador.DoesNotExist:
            return Response({"erro": "Utilizador não encontrado"}, status=status.HTTP_404_NOT_FOUND)
        except Cliente.DoesNotExist:
            return Response({"erro": "Client não encontrado"}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = ClienteSerializer(client)
        return Response(serializer.data, status=status.HTTP_200_OK)

class DriverCreateView(views.APIView):
    @extend_schema(
        summary="Registar um novo Motorista",
        description="Cria o utilizador base, perfil de cliente, e associa a carta de condução e ano de nascimento ao perfil de Motorista.",
        request=RegistoDriverSerializer,
        responses={201: inline_serializer(
            name='DriverCreateResponse',
            fields={'mensagem': serializers.CharField(), 'id': serializers.IntegerField()}
        )}
    )
    def post(self, request):
        serializer = RegistoDriverSerializer(data=request.data)
        if serializer.is_valid():
            dados = serializer.validated_data
            
            user = Utilizador.objects.create(
                nif=dados['nif'], nome=dados['nome'], email=dados['email'],
                genero=dados['genero'], senha=dados['senha']
            )
            Cliente.objects.create(id_user=user)
            Motorista.objects.create(
                id_user=user, 
                carta_conducao=dados['carta_conducao'], 
                ano_nascimento=dados['ano_nascimento']
            )
            
            return Response({"mensagem": "Motorista criado com sucesso!", "id": user.id}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class DriverDetailView(views.APIView):
    @extend_schema(
        summary="Consultar dados do Motorista",
        description="Devolve a informação detalhada de um motorista específico com base no ID do utilizador.",
        # O Swagger vai ler a estrutura diretamente do import abaixo
    )
    def get(self, request, id):
        try:
            # 1. Busca o utilizador pelo id
            user = Utilizador.objects.get(pk=id)
            driver = Motorista.objects.get(id_user=user)
        except Utilizador.DoesNotExist:
            return Response({"erro": "Utilizador não encontrado"}, status=status.HTTP_404_NOT_FOUND)
        except Motorista.DoesNotExist: # NOTA: Corrigi aqui de driver.DoesNotExist para Motorista.DoesNotExist para evitar bugs futuros
            return Response({"erro": "Motorista não encontrado"}, status=status.HTTP_404_NOT_FOUND)

        # 2. Serializa e devolve os dados
        from .serializers import MotoristaSerializer
        serializer = MotoristaSerializer(driver)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ManagerCreateView(views.APIView):
    @extend_schema(
        summary="Registar um novo Gestor",
        description="Cria o utilizador base e associa-lhe o perfil de Gestor da plataforma.",
        request=RegistoManagerSerializer,
        responses={201: inline_serializer(
            name='ManagerCreateResponse',
            fields={'mensagem': serializers.CharField(), 'id': serializers.IntegerField()}
        )}
    )
    def post(self, request):
        serializer = RegistoManagerSerializer(data=request.data)
        if serializer.is_valid():
            dados = serializer.validated_data
            
            user = Utilizador.objects.create(
                nif=dados['nif'], nome=dados['nome'], email=dados['email'],
                genero=dados['genero'], senha=dados['senha']
            )
            Gestor.objects.create(id_user=user)
            
            return Response({"mensagem": "Gestor criado com sucesso!", "id": user.id}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LoginView(views.APIView):
    @extend_schema(
        summary="Iniciar Sessão",
        description="Valida as credenciais do utilizador e devolve o tipo de perfil de acesso (Gestor, Motorista, Cliente).",
        request=inline_serializer(
            name='LoginRequest',
            fields={
                'email': serializers.EmailField(),
                'senha': serializers.CharField()
            }
        ),
        responses={200: inline_serializer(
            name='LoginSuccessResponse',
            fields={
                'mensagem': serializers.CharField(),
                'id': serializers.IntegerField(),
                'nome': serializers.CharField(),
                'email': serializers.EmailField(),
                'tipo': serializers.CharField()
            }
        )}
    )
    def post(self, request):
        email = request.data.get('email')
        senha = request.data.get('senha')
        if not email or not senha:
            return Response({"erro": "Email e senha são obrigatórios."},status=status.HTTP_400_BAD_REQUEST
        )
        try:
            user = Utilizador.objects.get(email=email, senha=senha)
        except Utilizador.DoesNotExist:
            return Response({"erro": "Credenciais inválidas."},status=status.HTTP_401_UNAUTHORIZED
            )
        #ve se esta banido 
        if user.is_banned:
            return Response(
                {"erro": "Conta suspensa."},
                status=status.HTTP_403_FORBIDDEN
            )
        # Determinar o tipo de utilizador
        tipo = None
        if Cliente.objects.filter(id_user=user).exists():
            tipo = "cliente"
        elif Motorista.objects.filter(id_user=user).exists():
            tipo = "motorista"
        else:
            return Response({"erro": "Utilizador sem perfil associado."},status=status.HTTP_403_FORBIDDEN
            )
        return Response({"mensagem": "Login efetuado com sucesso!","id": user.id,"nome": user.nome,"email": user.email,"tipo": tipo
        }, status=status.HTTP_200_OK) #o tipo vai com a mensagem 
    
class BanView(views.APIView):
    @extend_schema(
        summary="Banir ou Ativar Utilizador",
        description="Inverte o estado de suspensão (is_banned) de uma conta. Não requer dados no body.",
        request=None, # Como é um PATCH que apenas inverte o estado internamente, não precisamos de Body
        responses={200: inline_serializer(
            name='BanToggleResponse',
            fields={'mensagem': serializers.CharField()}
        )}
    )
    def patch(self, request, id):
        # Esta rota usa PATCH porque vamos atualizar apenas 1 campo (is_active)
        try:
            user = Utilizador.objects.get(id=id)
            
            # Inverte o estado atual (Se for True passa a False, e vice-versa)
            user.is_banned = not user.is_banned 
            user.save()
            
            estado_texto = "Banido" if user.is_banned else "Ativo"
            return Response({"mensagem": estado_texto}, status=status.HTTP_200_OK)
            
        except Utilizador.DoesNotExist:
            return Response({"erro": "Utilizador não encontrado."}, status=status.HTTP_404_NOT_FOUND)