# models.py
from django.db import models #basicamente o jdbc de css so que em pyhton

class Taxi(models.Model):
    matricula = models.CharField(max_length=10)
    quilometragem = models.IntegerField()
    marca = models.CharField(max_length=40)
    modelo = models.CharField(max_length=40)
    nivel_conforto = models.CharField(max_length=10, choices=[
        ('basico', 'Básico'),
        ('luxuoso', 'Luxuoso')
    ])
    tipo_motor = models.CharField(max_length=40)

    class Meta:
        db_table = 'taxi'
    

class Utilizador(models.Model):
    nif = models.CharField(max_length=12)
    nome = models.CharField(max_length=60)
    email = models.CharField(max_length=60)
    genero = models.CharField(max_length=15, choices=[
        ('femenino', 'Feminino'),
        ('masculino', 'Masculino'),
        ('outro', 'Outro'),
        ('sem resposta', 'Sem Resposta')
    ])
    senha = models.CharField(max_length=40)
    is_banned = models.BooleanField(default=False)

    class Meta:
        db_table = 'utilizador'

class Motorista(models.Model):
    id_user = models.OneToOneField(Utilizador, on_delete=models.CASCADE, db_column='id_user', primary_key=True)
    carta_conducao = models.CharField(max_length=12)
    ano_nascimento = models.CharField(max_length=4)

    class Meta:
        db_table = 'motorista'

class Gestor(models.Model):
    id_user = models.OneToOneField(Utilizador, on_delete=models.CASCADE, db_column='id_user', primary_key=True)

    class Meta:
        db_table = 'gestor'

class Cliente(models.Model):
    id_user = models.OneToOneField(Utilizador, on_delete=models.CASCADE, db_column='id_user', primary_key=True)
    
    class Meta:
        db_table = 'cliente'

class Periodo(models.Model):
    hora_inicio = models.DateTimeField()
    hora_fim = models.DateTimeField()

    class Meta:
        db_table = 'periodo_tempo'

class Turno(models.Model):
    id_taxi = models.ForeignKey(Taxi, on_delete=models.CASCADE)
    id_motorista = models.ForeignKey(Motorista, on_delete=models.CASCADE)
    id_periodo = models.ForeignKey(Periodo, on_delete=models.CASCADE)

    class Meta:
        db_table = 'turno'

class Reabastecimento(models.Model):
    euros = models.IntegerField()
    kwh = models.IntegerField(null=True, blank=True)
    litros = models.IntegerField(null=True, blank=True)
    quilometragem_inicial = models.IntegerField()
    id_turno = models.ForeignKey(Turno, on_delete=models.CASCADE)
    id_periodo = models.ForeignKey(Periodo, on_delete=models.CASCADE)

    class Meta:
        db_table = 'reabastecimento'

class Avaliacao(models.Model):
    valor = models.IntegerField()
    id_motorista = models.ForeignKey(Motorista, on_delete=models.CASCADE)
    id_cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE)

    class Meta:
        db_table = 'avaliacao'

class Viagem(models.Model):
    quilometros = models.IntegerField()
    origem = models.CharField(max_length=255)
    destino = models.CharField(max_length=255)
    nivel_conforto = models.CharField(max_length=10, choices=[
        ('basico', 'Básico'),
        ('luxuoso', 'Luxuoso')
    ])
    preco = models.IntegerField()
    id_turno = models.ForeignKey(Turno, on_delete=models.CASCADE)
    id_periodo = models.ForeignKey(Periodo, on_delete=models.CASCADE)

    class Meta:
        db_table = 'viagem'

class Fatura(models.Model):
    data = models.DateField()
    valor_total = models.DecimalField(max_digits=10, decimal_places=2)
    valor_pago = models.DecimalField(max_digits=10, decimal_places=2)
    nif = models.CharField(max_length=9)

    class Meta:
        db_table = 'fatura'

class PedidoViagem(models.Model):
    origem = models.CharField(max_length=255)
    destino = models.CharField(max_length=255)
    nivel_conforto = models.CharField(max_length=10, choices=[
        ('basico', 'Básico'),
        ('luxuoso', 'Luxuoso')
    ])
    estado = models.CharField(max_length=12, choices=[
        ('Em espera', 'Em Espera'),
        ('Confirmado', 'Confirmado'),
        ('Cancelado', 'Cancelado'),
        ('Suspenso', 'Suspenso')
    ])
    n_passageiros = models.IntegerField()

    class Meta:
        db_table = 'pedido_viagem'