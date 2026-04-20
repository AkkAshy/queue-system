# Queue Management System — NDPI Registrator ofisi

**Дата:** 2026-04-20
**Статус:** Design (ожидает ревью)
**Заказчик:** Ájiniyaz atındaǵı Nókis mámleketlik pedagogikalıq institutı — Registrator ofisi (офис регистратора)
**Референс:** Baraka Technology electronicQueue (изучен в `~/Projects/BarakaTexnika Ltd`)

---

## 1. Цель

Построить систему электронной очереди для офиса регистратора НДПИ: студент берёт талон в киоске, ждёт вызова на табло, оператор в окне вызывает следующего через пульт. Single-tenant (один универ), без multi-tenant / биллинга.

**Не входит в MVP:** HEMIS интеграция, онлайн-запись с телефона, SMS-оповещения, конструктор дизайна табло, отчёты, биллинг, мобильное приложение. Это backlog v2+.

## 2. Пользователи и сценарии

| Роль | Что делает |
|------|------------|
| **Студент** | Подходит к киоску, выбирает категорию услуги → получает талон с номером (например `A042`) и категорией → ждёт вызова на табло → идёт в указанное окно. |
| **Оператор** | Сидит за окном. В пульте видит очередь по своим услугам. Кнопки: *Вызвать следующего*, *Завершить*, *Пропустить*, *Перевести в другое окно*, *Перерыв*. |
| **Админ** | Настраивает услуги, окна, операторов, смены. Смотрит live-дашборд загрузки. |
| **Табло (display)** | Fullscreen web-страница на TV в зале ожидания — показывает активные вызовы и бегущую строку. Без интерактива. |

## 3. Данные: категории и услуги

Источник — PDF от заказчика `5. NDPI Registrator ofisida ko'rsatiladigan xizmatlar.PDF` (65 услуг). Полная расшифровка в `backend/apps/services/fixtures/services_seed.json` (будет сгенерирована на первой задаче плана).

**9 категорий → 9 префиксов талонов:**

| # | Категория | Префикс | Услуг | Цвет |
|---|-----------|---------|-------|------|
| 1 | Akademiyalıq iskerlik | A | 9 | #60a5fa |
| 2 | Onlayn arza tapsırıw | B | 6 | #60a5fa |
| 3 | HEMIS¹ | C | 8 | #a78bfa |
| 4 | Qosımsha xızmetler | D | 7 | #fbbf24 |
| 5 | Buxgalteriya hám marketing | E | 10 | #34d399 |
| 6 | Buyrıqlar / Akademiyalıq mobillik | F | 3 | #f87171 |
| 7 | Xalıqaralıq baylanıslar | G | 8 | #fb7185 |
| 8 | Ilimiy iskerlik | H | 7 | #22d3ee |
| 9 | Hújjetler | I | 7 | #e879f9 |

**У каждой услуги:** `name_kaa`, `name_ru`, `category_id`, `sla_days` (0 = сразу, 1 = 1 день, 3 = 3 дня, 10 = 3-10 дней), `delivery_type` (`electron` / `qagaz` / `awizeki` / `electron_qagaz` / `electron_awizeki` / `jiynalmali_papka`), `requires_visit` (boolean — услуги только `electron` = false, остальные = true).

**В MVP** студенты встают в очередь только по `requires_visit=true` (~35 из 65). Остальные показываются в справочнике киоска как "можно получить онлайн — подайте заявку в HEMIS".

> ¹ **HEMIS** — Higher Education Management Information System, официальная информационная система вузов Узбекистана. В MVP интеграции с ней нет, услуги категории просто числятся в справочнике. Интеграция — в v2.

## 4. Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│  VPS Ubuntu 24.04 (single box, Docker Compose)              │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  admin   │  │ operator │  │ display  │  │  kiosk   │    │
│  │ Next.js  │  │ Next.js  │  │ Next.js  │  │ Next.js  │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │             │             │             │           │
│       └─────────────┴──────┬──────┴─────────────┘           │
│                            │ HTTPS (Nginx reverse proxy)    │
│                   ┌────────▼────────┐                       │
│                   │   Django 6 API  │                       │
│                   │   DRF + OpenAPI │                       │
│                   │   Channels (WS) │                       │
│                   └────┬──────┬─────┘                       │
│                        │      │                              │
│                   ┌────▼───┐ ┌▼──────┐   ┌──────┐           │
│                   │Postgres│ │Redis  │   │Celery│           │
│                   │   16   │ │  7    │   │ beat │           │
│                   └────────┘ └───────┘   └──────┘           │
└──────────────────────────┬──────────────────────────────────┘
                           │ WSS
               ┌───────────▼───────────┐
               │  Go Agent (в офисе)   │   systemd unit
               │  - ESC/POS принтер    │
               │  - TTS озвучка        │
               │  - localhost:8089 REST│← киоск в офисе
               │  - offline queue      │   ходит сюда для печати
               └───────────────────────┘
```

**Принципы:**
- Фронты работают на моках (MSW) до фазы 4, потом подменяем на реальный API без изменений в UI.
- Все фронты делят типы (`packages/types`), API-клиент (`packages/api-client`) и UI (`packages/ui` — shadcn).
- API-контракт генерируется из Django через drf-spectacular → OpenAPI YAML → `packages/api-client` (typescript-fetch или orval).

## 5. Стек

**Monorepo:** pnpm workspace + Turborepo.

**Frontend (4 приложения):**
- Next.js 15 (App Router), TypeScript strict, React 19
- shadcn/ui + Tailwind CSS
- TanStack Query (server state), Zustand (client state)
- MSW (Mock Service Worker) — моки в фазах 1-3
- next-intl — локали `kaa` (default), `ru`

**Backend:**
- Django 6 + DRF
- drf-spectacular (OpenAPI)
- Django Channels (WebSocket через ASGI) + Redis layer
- Celery + Redis broker (будущие фоновые задачи: SMS, отчёты)
- SimpleJWT (access 15 мин + refresh 7 дней)
- PostgreSQL 16

**Local Agent:**
- Go 1.22+, single binary
- Goroutine: WSS к cloud (команды "печать", "озвучка")
- HTTP сервер на `localhost:8089` — киоск стучит сюда для печати
- Драйвер ESC/POS (github.com/mugli/go-escpos или аналог)
- Embedded bank каракалпакских WAV-файлов для озвучки номеров + TTS fallback

**Инфра:**
- VPS Ubuntu 24.04, Docker Compose
- Nginx reverse proxy + certbot (Let's Encrypt)
- PostgreSQL + Redis в контейнерах, volume-persistent

## 6. Модель данных (ядро)

```python
# backend/apps/core/models.py (упрощённо)

class User(AbstractUser):
    role = models.CharField(choices=[('admin','admin'),('operator','operator'),('viewer','viewer')])

class ServiceCategory(models.Model):
    code = models.CharField(max_length=1, unique=True)  # A, B, C...
    name_kaa = models.CharField(max_length=200)
    name_ru = models.CharField(max_length=200)
    color = models.CharField(max_length=7)              # #60a5fa
    order = models.IntegerField(default=0)

class Service(models.Model):
    category = models.ForeignKey(ServiceCategory)
    name_kaa = models.CharField(max_length=300)
    name_ru = models.CharField(max_length=300)
    sla_days = models.IntegerField(default=0)
    delivery_type = models.CharField(choices=[
        ('electron','electron'),('qagaz','qagaz'),('awizeki','awizeki'),
        ('electron_qagaz','electron_qagaz'),('electron_awizeki','electron_awizeki'),
        ('jiynalmali_papka','jiynalmali_papka')])
    requires_visit = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

class Counter(models.Model):          # окно
    number = models.CharField(max_length=10)   # "1", "2A"
    name = models.CharField(max_length=100)
    services = models.ManyToManyField(Service)  # какие услуги обслуживает
    is_active = models.BooleanField(default=True)

class Ticket(models.Model):
    number = models.CharField(max_length=10)   # A042
    category = models.ForeignKey(ServiceCategory)
    service = models.ForeignKey(Service, null=True)  # опционально
    status = models.CharField(choices=[
        ('waiting','waiting'),('called','called'),
        ('serving','serving'),('served','served'),
        ('skipped','skipped'),('cancelled','cancelled')])
    counter = models.ForeignKey(Counter, null=True)
    operator = models.ForeignKey(User, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    called_at = models.DateTimeField(null=True)
    started_at = models.DateTimeField(null=True)
    finished_at = models.DateTimeField(null=True)

class OperatorSession(models.Model):  # смена
    user = models.ForeignKey(User)
    counter = models.ForeignKey(Counter)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True)
    status = models.CharField(choices=[('active','active'),('break','break'),('ended','ended')])

class AuditLog(models.Model):
    actor = models.ForeignKey(User, null=True)
    action = models.CharField(max_length=50)
    target_type = models.CharField(max_length=50)
    target_id = models.CharField(max_length=50)
    payload = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
```

**Генерация номера талона:** день сбрасывается в 00:00 (Celery beat task). Внутри дня — автоинкремент по `category.code`. Unique constraint `(number, created_at::date)`.

## 7. Real-time

**WebSocket-каналы (Django Channels):**
- `display:<counter_id>` — табло слушает вызовы по конкретному окну (можно слушать все).
- `operator:<user_id>` — оператор получает обновления своей очереди.
- `admin:dashboard` — live метрики.
- `agent:office` — локальный агент в офисе получает команды печати/озвучки (один агент на офис; если появятся филиалы, станет `agent:<location_id>`).

**События:** `ticket.created`, `ticket.called`, `ticket.started`, `ticket.finished`, `ticket.skipped`, `counter.status_changed`.

**Fallback:** если WS упал, фронт делает polling 3 сек. TanStack Query `refetchInterval`.

## 8. Фазы реализации (обновлено 2026-04-20)

Пользователь выбрал начать с **киоска** — с реальным принтером с первого дня. Порядок изменён:

| # | Фаза | Что сделано по итогу |
|---|------|---------------------|
| 0 | Скелет монорепо | `apps/*`, `packages/*`, `backend/`, `agent/`. pnpm + Turborepo. ESLint/Prettier/TS shared configs. Seed PDF → JSON-фикстура услуг. |
| 1 | **Киоск — фронт** | Next.js app `kiosk` touch UI. Локаль `kaa`. Выбор категории → подкатегории/услуги → подтверждение → вызов API печати (пока mock — логирует в консоль). Fullscreen kiosk-mode. |
| 2 | **Go-агент + Xprinter XP-80T** | Go-бинарь, HTTP на `localhost:8089`, драйвер ESC/POS. Шаблон чека (80mm, логотип НДПИ, номер талона крупно, категория, дата/время, QR). Тест — реальная печать из киоска. |
| 3 | Админка на моках | Next.js app `admin`. CRUD услуг/окон/операторов, дашборд-заглушка. |
| 4 | Пульт оператора на моках | Next.js app `operator`. Большие кнопки, очередь, переключатель окна. |
| 5 | Табло на моках | Next.js app `display`. Fullscreen, активные вызовы, бегущая строка, анимации, звук. |
| 6 | Django API | Модели, миграции, DRF, SimpleJWT, drf-spectacular. Seed-команда `load_services_fixture`. Замена MSW на реальный API во всех фронтах. |
| 7 | Real-time | Channels + Redis. Пульт → Cloud → табло/киоск/агент мгновенно. |
| 8 | Deploy | Docker Compose на VPS, Nginx + certbot, systemd для агента. Первый прогон на железе в офисе. |

Каждая фаза — отдельный имплементационный план, пишется из этого спека через `writing-plans`.

## 9. Нерешённые моменты (уточнить до фазы 4)

1. **Авторизация операторов:** логин/пароль или карта/NFC? По умолчанию — логин/пароль + TOTP для админа.
2. ~~**Принтер**~~ ✅ **Xprinter XP-80T** — 80mm термо, ESC/POS, USB. Ширина печати 72mm (576 dots @ 203 DPI). Есть auto-cutter. Go-библиотека: `github.com/hennedo/escpos` через raw USB (`/dev/usb/lp0` на Linux, shared printer на Windows).
3. **Озвучка:** готовые WAV-семплы номеров на каракалпакском или TTS через сервис? По умолчанию — WAV-семплы "Номер" + "А" + "ноль" + "четыре" + "два" + "окно" + "три".
4. **Табло — аппарат:** Smart TV (Tizen/webOS) или мини-ПК на Ubuntu в kiosk-mode? По умолчанию — мини-ПК (проще, стабильнее).
5. **Фактическое количество окон:** 3? 5? 9 (по одному на категорию)? Влияет на UX табло. По умолчанию — 5-6 окон, категории мержатся.

## 10. Риски

- **Обрывы интернета в офисе** → Go-агент должен работать офлайн: буферизовать команды печати, сохранять талоны локально в SQLite и синхронизировать при восстановлении связи.
- **Принтер не отвечает** → UI киоска показывает "Попробуйте ещё раз / обратитесь к оператору", не падает.
- **Параллельная печать двух талонов** → blockchain-like lock на счётчик номера через Redis `INCR`.
- **Задержка Channels** → WS health-check каждые 15 сек, автореконнект.

## 11. Метрики успеха MVP

1. Студент получает талон за ≤10 сек после тапа в киоске.
2. Вызов оператора до появления на табло ≤1 сек (p95).
3. Система выдерживает 200 талонов в день на одном VPS (2 CPU / 4 GB RAM).
4. Офлайн-режим агента: 30 мин без связи → ноль потерянных талонов.
