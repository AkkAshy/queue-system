from rest_framework import generics

from accounts.permissions import IsChiefOrReadOnly

from .models import Hall, Service, ServiceCategory
from .serializers import HallSerializer, ServiceCategorySerializer, ServiceSerializer


class HallListView(generics.ListCreateAPIView):
    queryset = Hall.objects.filter(is_active=True)
    serializer_class = HallSerializer
    pagination_class = None
    permission_classes = [IsChiefOrReadOnly]


class HallDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Hall.objects.all()
    serializer_class = HallSerializer
    permission_classes = [IsChiefOrReadOnly]


class CategoryListView(generics.ListCreateAPIView):
    serializer_class = ServiceCategorySerializer
    pagination_class = None
    permission_classes = [IsChiefOrReadOnly]

    def get_queryset(self):
        qs = ServiceCategory.objects.all()
        hall_id = self.request.query_params.get("hall_id")
        if hall_id:
            qs = qs.filter(hall_id=hall_id)
        return qs


class CategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ServiceCategory.objects.all()
    serializer_class = ServiceCategorySerializer
    permission_classes = [IsChiefOrReadOnly]


class ServiceListView(generics.ListCreateAPIView):
    serializer_class = ServiceSerializer
    pagination_class = None
    permission_classes = [IsChiefOrReadOnly]

    def get_queryset(self):
        qs = Service.objects.all()
        category_id = self.request.query_params.get("category_id")
        if category_id:
            qs = qs.filter(category_id=category_id)
        return qs


class ServiceDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer
    permission_classes = [IsChiefOrReadOnly]
