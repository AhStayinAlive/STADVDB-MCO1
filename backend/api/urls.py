from django.urls import path
from . import views

urlpatterns = [
    path("olap/aggregate/", views.olap_aggregate, name="olap_aggregate"),
]
