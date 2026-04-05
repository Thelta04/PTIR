# models.py
from django.db import models


class Taxi(models.Model):
    license_plate = models.CharField(max_length=8, primary_key=True)
    purchase_year = models.CharField(max_length=4)
    mileage = models.IntegerField()
    brand = models.CharField(max_length=40)
    model = models.CharField(max_length=40)
    comfort_level = models.CharField(max_length=10, choices=[
        ('basic', 'Basic'),
        ('luxury', 'Luxury')
    ])
    engine_type = models.CharField(max_length=40)
    num_passengers = models.IntegerField()

    class Meta:
        db_table = 'taxi'
    

class User(models.Model):
    nif = models.CharField(max_length=12)
    name = models.CharField(max_length=60)
    email = models.CharField(max_length=60)
    gender = models.CharField(max_length=15, choices=[('male', 'Male'), ('female', 'Female'), ('other', 'Other')])
    password = models.CharField(max_length=40)
    is_banned = models.BooleanField(default=False)                                                                                
    @property                                                                                                                    
    def is_authenticated(self):                                                                                                  
        return True  

    class Meta:
        db_table = 'user_account'

class Driver(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, db_column='id_user', primary_key=True)
    license_number = models.CharField(max_length=12)
    birth_year = models.CharField(max_length=4)

    class Meta:
        db_table = 'driver'

class Manager(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, db_column='id_user', primary_key=True)

    class Meta:
        db_table = 'manager'

class Client(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, db_column='id_user', primary_key=True)
    
    class Meta:
        db_table = 'client'

class TimeInterval(models.Model):
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'time_interval'

class Shift(models.Model):
    taxi = models.ForeignKey(Taxi,db_column='id_taxi', on_delete=models.CASCADE)
    driver = models.ForeignKey(Driver,db_column='id_driver', on_delete=models.CASCADE)
    scheduled_interval = models.ForeignKey(
        TimeInterval,
        on_delete=models.CASCADE,
        related_name='shift_scheduled',
        help_text='Scheduled interval (planned start and end)'
    )
    real_interval = models.ForeignKey(
        TimeInterval,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='shift_real',
        help_text='Real interval (actual start and end of the shift)'
    )

    class Meta:
        db_table = 'shift'

class Refueling(models.Model):
    cost = models.IntegerField()
    kwh = models.IntegerField(null=True, blank=True)
    liters = models.IntegerField(null=True, blank=True)
    initial_mileage = models.IntegerField()
    shift = models.ForeignKey(Shift, on_delete=models.CASCADE)
    interval = models.ForeignKey(TimeInterval, on_delete=models.CASCADE)

    class Meta:
        db_table = 'refueling'

class Trip(models.Model):
    kilometers     = models.IntegerField()
    originCoords   = models.CharField(max_length=255, db_column='origin_coords')
    destCoords     = models.CharField(max_length=255, db_column='dest_coords')
    originAddress  = models.CharField(max_length=255, db_column='origin_address')
    destAddress    = models.CharField(max_length=255, db_column='dest_address')
    comfort_level  = models.CharField(max_length=10, choices=[('basic','Basic'),('luxury','Luxury')])
    price          = models.DecimalField(max_digits=10, decimal_places=2)
    num_passengers = models.IntegerField()
    status         = models.CharField(max_length=20, choices=[
        ('PENDING',         'Pending'),
        ('DRIVER_ACCEPTED', 'Driver Accepted'),
        ('CLIENT_ACCEPTED', 'Client Accepted'),
        ('IN_PROGRESS',     'In Progress'),
        ('COMPLETED',       'Completed'),
        ('CANCELED',        'Canceled'),
    ], default='PENDING')
    client   = models.ForeignKey(Client, on_delete=models.CASCADE, db_column='id_client')   # ← fix
    shift    = models.ForeignKey(Shift, on_delete=models.CASCADE, db_column='id_shift')     # ← fix
    interval = models.ForeignKey(TimeInterval, on_delete=models.CASCADE, db_column='id_interval')  # ← fix

    class Meta:
        db_table = 'trip'

class Rating(models.Model):
    trip = models.OneToOneField(Trip, on_delete=models.CASCADE, db_column='id_trip', primary_key=True)
    score = models.IntegerField()

    class Meta:
        db_table = 'rating'

class Invoice(models.Model):
    date = models.DateField()
    amount_total = models.DecimalField(max_digits=10, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2)
    nif = models.CharField(max_length=9)

    class Meta:
        db_table = 'invoice'

class TripRequest(models.Model):
    origin = models.CharField(max_length=255)
    destination = models.CharField(max_length=255)
    comfort_level = models.CharField(max_length=10, choices=[
        ('basic', 'Basic'),
        ('luxury', 'Luxury')
    ])
    status = models.CharField(max_length=12, choices=[
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('canceled', 'Canceled'),
        ('suspended', 'Suspended')
    ])
    num_passengers = models.IntegerField()

    class Meta:
        db_table = 'trip_request'