from rest_framework import generics

from .models import Service, ServiceCategory
from .serializers import ServiceCategorySerializer, ServiceSerializer


class CategoryListView(generics.ListAPIView):
    queryset = ServiceCategory.objects.all()
    serializer_class = ServiceCategorySerializer
    pagination_class = None


class CategoryDetailView(generics.UpdateAPIView):
    queryset = ServiceCategory.objects.all()
    serializer_class = ServiceCategorySerializer


class ServiceListView(generics.ListAPIView):
    serializer_class = ServiceSerializer
    pagination_class = None

    def get_queryset(self):
        qs = Service.objects.all()
        category_id = self.request.query_params.get("category_id")
        if category_id:
            qs = qs.filter(category_id=category_id)
        return qs


class ServiceDetailView(generics.UpdateAPIView):
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer
