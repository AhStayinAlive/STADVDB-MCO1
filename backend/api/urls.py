from django.urls import path
from . import views

urlpatterns = [
    path("olap/aggregate", views.olap_aggregate),
    path("olap/portfolio_kpis", views.portfolio_kpis),
]
