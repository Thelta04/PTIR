#Definir as rotas da API (/api/taxis/ ou /api/viagens/) 

from django.contrib import admin
from django.urls import path, include
from api import views

urlpatterns = [

    # # Rotas para autenticação
    # # path('auth/password-reset/', views.reset_passwd),
    # path('auth/login/', views.login),
    # path('auth/register/cliente/', views.register_cli),
    # path('auth/register/motorista/', views.register_mot),

    # # Rotas para clientes
    # path('clients/', views.get_all_clients),
    # path('clients/<int:id>/', views.ClienteCreateView.get),
    # # path('clients/<int:id>/trips', views.get_client_trips),
    
    # # Rotas para motoristas
    # path('drivers/', views.get_all_drivers),
    # path('drivers/<int:id>/', views.driver),
    # # path('drivers/<int:id>/rate', views.post_driver_rate),

    # # Rotas para gestores
    # path('gestor/', views.get_all_gestores),
    # path('gestor/<int:id>/', views.gestor),

    # # Rotas para taxis
    # path('taxis/', views.get_all_taxis),
    # path('taxis/<int:id>/', views.taxi),
    # # path('taxis/available', views.get_available_taxis),

    # Táxis
    path('taxis/', views.TaxiListCreateView.as_view(), name='ver_taxis'),
    
    #Utilizadores
    #Gets
    path('client/<int:id>', views.ClientDetailView.as_view(), name='ver_clientes'),
    path('driver/<int:id>', views.DriverDetailView.as_view(), name='ver_motoristas'),

    # Registos
    path('auth/register/client/', views.ClientCreateView.as_view(), name='registo_cliente'),
    path('auth/register/driver/', views.DriverCreateView.as_view(), name='registo_motorista'),
    path('auth/register/manager/', views.ManagerCreateView.as_view(), name='registo_gestor'),
    
    # Autenticação (Login)
    path('auth/login/', views.LoginView.as_view(), name='login'),
    
    # Gestão de Contas (Ativar / Desativar)
    path('user/<int:id>/toggle-status/', views.BanView.as_view(), name='toggle-status'),
]