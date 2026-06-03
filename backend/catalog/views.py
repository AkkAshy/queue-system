from rest_framework import generics

from .models import Service, ServiceCategory
from .serializers import ServiceCategorySerializer, ServiceSerializer


class CategoryListView(generics.ListCreateAPIView):
    queryset = ServiceCategory.objects.all()
    serializer_class = ServiceCategorySerializer
    pagination_class = None


class CategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ServiceCategory.objects.all()
    serializer_class = ServiceCategorySerializer


class ServiceListView(generics.ListCreateAPIView):
    serializer_class = ServiceSerializer
    pagination_class = None

    def get_queryset(self):
        qs = Service.objects.all()
        category_id = self.request.query_params.get("category_id")
        if category_id:
            qs = qs.filter(category_id=category_id)
        return qs


class ServiceDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer
