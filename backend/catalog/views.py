from rest_framework import generics
from rest_framework.exceptions import PermissionDenied

from accounts.permissions import IsCatalogManager, IsChiefOrReadOnly, scope_to_hall

from .models import Hall, Service, ServiceCategory
from .serializers import HallSerializer, ServiceCategorySerializer, ServiceSerializer


def _audit(request, action, target):
    """Lazy import avoids a catalog ↔ queue_app module-load cycle."""
    from queue_app.audit import log
    log(request, action, target=str(target))


# Halls are managed by the chief; a hall_admin only sees their own hall (scoped
# by the hall's own id), so even a direct GET can't list other halls.
class HallListView(generics.ListCreateAPIView):
    serializer_class = HallSerializer
    pagination_class = None
    permission_classes = [IsChiefOrReadOnly]

    def get_queryset(self):
        return scope_to_hall(Hall.objects.filter(is_active=True), self.request, "id")


class HallDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Hall.objects.all()
    serializer_class = HallSerializer
    permission_classes = [IsChiefOrReadOnly]


class CategoryListView(generics.ListCreateAPIView):
    serializer_class = ServiceCategorySerializer
    pagination_class = None
    permission_classes = [IsCatalogManager]

    def get_queryset(self):
        # Каталог общий для всех залов: без hall-фильтра. Маршрут талона — по
        # услугам окна (queue_for_counter), а не по залу.
        return ServiceCategory.objects.all()

    def perform_create(self, serializer):
        u = self.request.user
        # A hall_admin can only create in their own hall.
        if getattr(u, "is_hall_admin", False) and u.hall_id:
            obj = serializer.save(hall_id=u.hall_id)
        else:
            obj = serializer.save()
        _audit(self.request, "category.created", obj.id)


class CategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ServiceCategorySerializer
    permission_classes = [IsCatalogManager]

    def get_queryset(self):
        return ServiceCategory.objects.all()

    def perform_update(self, serializer):
        obj = serializer.save()
        _audit(self.request, "category.updated", obj.id)

    def perform_destroy(self, instance):
        ident = instance.id
        instance.delete()
        _audit(self.request, "category.deleted", ident)


class ServiceListView(generics.ListCreateAPIView):
    serializer_class = ServiceSerializer
    pagination_class = None
    permission_classes = [IsCatalogManager]

    def get_queryset(self):
        qs = Service.objects.all()
        category_id = self.request.query_params.get("category_id")
        if category_id:
            qs = qs.filter(category_id=category_id)
        return qs  # каталог общий для всех залов (без hall-фильтра)

    def perform_create(self, serializer):
        u = self.request.user
        if getattr(u, "is_hall_admin", False) and u.hall_id:
            category = serializer.validated_data.get("category")
            if category is None or category.hall_id != u.hall_id:
                raise PermissionDenied("Услуга должна быть в вашем зале")
        obj = serializer.save()
        _audit(self.request, "service.created", obj.id)


class ServiceDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ServiceSerializer
    permission_classes = [IsCatalogManager]

    def get_queryset(self):
        return Service.objects.all()

    def perform_update(self, serializer):
        obj = serializer.save()
        _audit(self.request, "service.updated", obj.id)

    def perform_destroy(self, instance):
        ident = instance.id
        instance.delete()
        _audit(self.request, "service.deleted", ident)
