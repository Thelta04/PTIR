# Define the API routes (/api/taxis/ or /api/trips/) 

from django.contrib import admin
from django.urls import path, include
from api import views

urlpatterns = [
    
    # Users
    # Gets
    path('client/<int:id>', views.ClientDetailView.as_view(), name='client_detail'),
    path('driver/<int:id>', views.DriverDetailView.as_view(), name='driver_detail'),
    path('taxi/<str:license_plate>', views.TaxiDetailView.as_view(), name='taxi_detail'),

    # Registration
    path('auth/register/client/', views.ClientCreateView.as_view(), name='register_client'),
    path('auth/register/driver/', views.DriverCreateView.as_view(), name='register_driver'),
    path('auth/register/manager/', views.ManagerCreateView.as_view(), name='register_manager'),

    # Taxis
    path('taxi/register/', views.TaxiCreateView.as_view(), name='register_taxi'),
    
    # Shifts
    path('shift/create/', views.ShiftCreateView.as_view(), name='create_shift'),
    path('shift/get/<int:id>/', views.ShiftListView.as_view(), name='list_shifts'),
    path('shift/<int:id>/delete/', views.ShiftDeleteView.as_view(), name='delete_shift'),

    # Authentication (Login)
    path('auth/login/', views.LoginView.as_view(), name='login'),
    
    # Account Management (Activate / Deactivate)
    path('user/<int:id>/toggle-status/', views.BanView.as_view(), name='toggle-status'),
]