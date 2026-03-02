#Definir as rotas da API (/api/taxis/ ou /api/viagens/) 

from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
     # Encaminha tudo o que começa por /api/ para a app
    path('api/', include('api.urls')),
]