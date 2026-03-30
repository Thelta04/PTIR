#Definir as rotas da API (/api/taxis/ ou /api/viagens/) 

from django.contrib import admin
from django.urls import path, include
from api import views

urlpatterns = [
    
    #Utilizadores
    #Gets
    path('client/<int:id>', views.ClientDetailView.as_view(), name='ver_clientes'),
    path('driver/<int:id>', views.DriverDetailView.as_view(), name='ver_motoristas'),
    path('taxi/<str:matricula>', views.TaxiDetailView.as_view(), name='ver_taxi'),

    # Registos
    path('auth/register/client/', views.ClientCreateView.as_view(), name='registo_cliente'),
    path('auth/register/driver/', views.DriverCreateView.as_view(), name='registo_motorista'),
    path('auth/register/manager/', views.ManagerCreateView.as_view(), name='registo_gestor'),

    # Táxis
    path('taxi/register/', views.TaxiCreateView.as_view(), name='ver_taxis'),
    
    # Autenticação (Login)
    path('auth/login/', views.LoginView.as_view(), name='login'),
    
    # Gestão de Contas (Ativar / Desativar)
    path('user/<int:id>/toggle-status/', views.BanView.as_view(), name='toggle-status'),
]