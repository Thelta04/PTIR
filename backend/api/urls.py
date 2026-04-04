# Define the API routes (/api/taxis/ or /api/trips/) 

from django.contrib import admin
from django.urls import path, include
from api import views

urlpatterns = [
    
    # Users
    # Gets
    path('client/<int:id>', views.ClientDetailView.as_view(), name='client_detail'),
    path('client/', views.ClientListView.as_view(), name='list_clients'),
    path('driver/<int:id>', views.DriverDetailView.as_view(), name='driver_detail'),
    path('driver/', views.DriverListView.as_view(), name='list_drivers'),
    path('taxi/<str:license_plate>', views.TaxiDetailView.as_view(), name='taxi_detail'),
    path('taxi/', views.TaxiListView.as_view(), name='list_taxis'),

    # Registration
    path('auth/create/client/', views.ClientCreateView.as_view(), name='create_client'),
    path('auth/create/driver/', views.DriverCreateView.as_view(), name='create_driver'),
    path('auth/create/manager/', views.ManagerCreateView.as_view(), name='create_manager'),

    # Taxis
    path('taxi/create/', views.TaxiCreateView.as_view(), name='create_taxi'),
    
    # Shifts
    path('shift/create/', views.ShiftCreateView.as_view(), name='create_shift'),
    path('shift/get/<int:id>/', views.ShiftListView.as_view(), name='list_shifts_driver'),
    path('shift/', views.ShiftListViews.as_view(), name='list_shifts_all'),
    path('shift/<int:id>/start', views.ShiftStartView.as_view(), name='start_shift'),
    path('shift/<int:id>/end', views.ShiftEndView.as_view(), name='end_shift'),
    path('shift/<int:id>/delete/', views.ShiftDeleteView.as_view(), name='delete_shift'),

    # Authentication
    path('auth/login/', views.LoginView.as_view(), name='login'),
    path('auth/token/refresh/', views.TokenRefreshView.as_view(), name='token_refresh'),
    
    # Account Management (Ban - Manager only)
    path('user/<int:id>/toggle-status/', views.BanView.as_view(), name='toggle-status'),
    
    
    # # Trips (viagens)
    path('trip/', views.TripListView.as_view(), name='list_trips'),
    path('trip/create/', views.TripCreateView.as_view(), name='create_trip'),
    path('trip/<int:id>/accept/', views.TripAcceptView.as_view(), name='accept_trip'),
    path('trip/<int:id>/cancel/', views.TripCancelView.as_view(), name='cancel_trip'),
    path('trip/<int:id>/complete/', views.TripCompleteView.as_view(), name='complete_trip')
]