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
    path('taxi/<str:license_plate>/delete/', views.TaxiDeleteView.as_view(), name='delete_taxi'),
    path('taxi/<str:license_plate>/mileage/', views.TaxiUpdateMileageView.as_view()),


    
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
    path('user/<int:id>/profile-pic/', views.UserProfilePicUpdateView.as_view(), name='update_profile_pic'),
    path('user/<int:id>/delete/', views.UserDeleteView.as_view(), name='delete_user'),

    
    # Trips (viagens)
    path('trip/', views.TripListView.as_view(), name='list_trips'),
    path('client/<int:id>/trips/', views.ClientTripListView.as_view(), name='list_client_trips'),
    path('driver/<int:id>/trips/', views.DriverTripListView.as_view(), name='list_driver_trips'),
    path('trip/create/', views.TripCreateView.as_view(), name='create_trip'),
    path('trip/<int:id>/accept/', views.TripAcceptView.as_view(), name='accept_trip_driver'),
    path('trip/<int:id>/cancel/', views.TripCancelView.as_view(), name='cancel_trip'),
    path('trip/<int:id>/complete/', views.TripCompleteView.as_view(), name='complete_trip'),
    path('trip/<int:id>/pay-mock/', views.TripPayMockView.as_view(), name='pay_mock_trip'),
    path('trip/<int:id>/payment/start/', views.TripPaymentStartView.as_view(), name='start_trip_payment'),
    path('trip/<int:id>/payment/status/', views.TripPaymentStatusView.as_view(), name='trip_payment_status'),
    path('trip/<int:id>/invoice/', views.TripInvoiceView.as_view(), name='trip_invoice'),
    path('trip/<int:id>/client-accept/', views.TripClientAcceptView.as_view(), name='accept_trip_client'),
    path('trip/<int:id>/pickup/', views.TripPickupView.as_view(), name='start_trip'),
    path('route/', views.RouteGeometryView.as_view(), name='route_geometry'),
    path('payments/stripe/webhook/', views.StripeWebhookView.as_view(), name='stripe_webhook'),

    # Invoices
    path('invoices/', views.InvoiceListView.as_view(), name='list_invoices'),
    path('invoices/<int:id>/', views.InvoiceDetailView.as_view(), name='invoice_detail'),
    path('client/<int:id>/invoices/', views.ClientInvoiceListView.as_view(), name='list_client_invoices'),


    # Ratting
    path('rating/create/', views.RatingCreateView.as_view(), name='rate_trip'),
    path('rating/<int:driver_id>/', views.RatingListView.as_view(), name='list_ratings'),

    # Refuels
    path('refuels/', views.RefuelListCreateView.as_view(), name='refuels'),


    # Health Check
    path('check/', views.CheckHealthView.as_view(), name='check_health'),
    path('pricing/', views.PricingConfigView.as_view(), name= 'pricing'),
]
