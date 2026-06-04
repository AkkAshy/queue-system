from rest_framework import generics
from rest_framework.exceptions import PermissionDenied

from accounts.permissions import IsCatalogManager, IsChiefOrReadOnly, scope_to_hall

from .models import Hall, Service, ServiceCategory
from .serializers import HallSerializer, ServiceCategorySerializer, ServiceSerializer


# Halls themselves are managed by the chief only.
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
    permission_classes = [IsCatalogManager]

    def get_queryset(self):
        qs = ServiceCategory.objects.all()
        hall_id = self.request.query_params.get("hall_id")
        if hall_id:
            qs = qs.filter(hall_id=hall_id)
        return scope_to_hall(qs, self.request)  # hall_admin → only their hall

    def perform_create(self, serializer):
        u = self.request.user
        # A hall_admin can only create in their own hall.
        if getattr(u, "is_hall_admin", False) and u.hall_id:
            serializer.save(hall_id=u.hall_id)
        else:
            serializer.save()


class CategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ServiceCategorySerializer
    permission_classes = [IsCatalogManager]

    def get_queryset(self):
        # Scoping the queryset means a hall_admin gets 404 (not 403) for another
        # hall's object — effective per-object protection for free.
        return scope_to_hall(ServiceCategory.objects.all(), self.request)


class ServiceListView(generics.ListCreateAPIView):
    serializer_class = ServiceSerializer
    pagination_class = None
    permission_classes = [IsCatalogManager]

    def get_queryset(self):
        qs = Service.objects.all()
        category_id = self.request.query_params.get("category_id")
        if category_id:
            qs = qs.filter(category_id=category_id)
        return scope_to_hall(qs, self.request, field="category__hall_id")

    def perform_create(self, serializer):
        u = self.request.user
        if getattr(u, "is_hall_admin", False) and u.hall_id:
            category = serializer.validated_data.get("category")
            if category is None or category.hall_id != u.hall_id:
                raise PermissionDenied("Услуга должна быть в вашем зале")
        serializer.save()


class ServiceDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ServiceSerializer
    permission_classes = [IsCatalogManager]

    def get_queryset(self):
        return scope_to_hall(Service.objects.all(), self.request, field="category__hall_id")
