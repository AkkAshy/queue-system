# Запуск на Windows-боксе (локальный сервер очереди)

Пошаговая инструкция: поднять всю систему электронной очереди на **рабочем
компе сотрудника** (локальный «бокс»). Бокс работает **офлайн по LAN**, а когда
есть интернет — синхронизируется с облаком `nmpi.avtoxizmet.uz`.

---

## 0. Как это устроено (картинка)

```
                 ┌─────────────────── ЛОКАЛЬНЫЙ БОКС (этот комп) ───────────────────┐
                 │  Docker Desktop:                                                  │
   LAN-устройства│   db · redis · backend(:8000) · sync_worker                       │
   (браузеры)  ──┼──▶ nginx :80  ─┬─ /         → kiosk                               │
                 │                 ├─ /admin    → admin                              │
                 │                 ├─ /operator → operator                          │
                 │                 ├─ /tablo    → display (табло)                    │
                 │                 └─ /api /ws  → backend                            │
                 │   sync_worker ⇄ интернет ⇄ ОБЛАКО (nmpi.avtoxizmet.uz)            │
                 └───────────────────────────────────────────────────────────────────┘
   киоск-ПК (с принтером): браузер на http://<BOX_IP>/  + Go-агент печати (:8089)
   табло (монитор):        браузер на http://<BOX_IP>/tablo
   пульты операторов:      браузер на http://<BOX_IP>/operator (или десктоп-виджет)
```

- **Каталог** (услуги, окна, юзеры, залы) — приходит из облака (`sync_worker` тянет вниз).
- **События** (талоны, вызовы, аудит) — копятся локально и уходят в облако, когда есть связь.
- Без интернета всё продолжает работать; синк догонит при восстановлении связи.

---

## 1. Что нужно на боксе (один раз)

1. **Windows 10/11 (64-bit)**, виртуализация включена в BIOS (Intel VT-x / AMD-V).
2. **Docker Desktop** — https://www.docker.com/products/docker-desktop/
   - При установке выбрать **WSL 2 backend** (предложит сам).
   - После установки запустить Docker Desktop, дождаться статуса **Running** (кит в трее зелёный).
3. **Статический IP** для бокса в LAN — чтобы адрес не менялся:
   - либо в роутере зарезервировать IP по MAC-адресу бокса,
   - либо задать статический IP в настройках сети Windows.
   - Запомнить этот адрес, например `192.168.1.50` — дальше это `<BOX_IP>`.
4. **Открыть порт 80** в брандмауэре Windows для локальной сети:
   - «Брандмауэр Защитника Windows» → «Дополнительные параметры» → «Правила для входящих
     подключений» → «Создать правило» → Порт → TCP **80** → Разрешить (профиль «Частная»).

---

## 2. Положить код на бокс

Вариант А — через git (нужен Git for Windows):
```powershell
cd C:\
git clone https://github.com/AkkAshy/queue-system.git
cd queue-system
git checkout feat/kiosk-printer-select
```

Вариант Б — без git: скачать ZIP ветки `feat/kiosk-printer-select` с GitHub,
распаковать в `C:\queue-system`.

> Дальше все команды выполняются из папки `C:\queue-system` в **PowerShell**.

---

## 3. Настроить `.env.local`

Скопировать пример и заполнить:
```powershell
copy deploy\.env.local.example deploy\.env.local
notepad deploy\.env.local
```

Заполнить значения:
```ini
# Адрес бокса в LAN — устройства открывают http://<это>/.
# ВАЖНО: если изменишь — нужно пересобрать фронты (см. §6).
BOX_HOST=192.168.1.50

# Django
SECRET_KEY=<любая_длинная_случайная_строка>
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,192.168.1.50
CORS_ALLOWED_ORIGINS=http://192.168.1.50

# Postgres (локальная БД бокса — пароль придумать свой)
POSTGRES_USER=queue
POSTGRES_PASSWORD=<придумать_пароль>
POSTGRES_DB=queue_system
DATABASE_URL=postgres://queue:<тот_же_пароль>@db:5432/queue_system

REDIS_URL=redis://redis:6379/0

# Первый запуск с интернетом — sync_worker сам стянет каталог из облака.
# Если хочешь стартовать офлайн без облака — поставь 1 (засеет демо-каталог),
# после первого старта верни 0.
SEED_ON_START=0

# --- Синхронизация с облаком ---
SYNC_ROLE=local
CLOUD_URL=https://nmpi.avtoxizmet.uz
SYNC_TOKEN=<ВЗЯТЬ_ТОТ_ЖЕ_ТОКЕН_ЧТО_НА_ПРОДЕ>
SYNC_INTERVAL=15
SYNC_BACKOFF_MAX=300
```

> 🔑 `SYNC_TOKEN` должен **совпадать** с тем, что в облаке (`deploy/.env.prod` на VPS).
> Значение хранится в `claude-comms/nmpi-queue/` на сервере и в моей переписке —
> спроси, если не сохранил.

---

## 4. Запуск

```powershell
docker compose -f deploy\docker-compose.local.yml --env-file deploy\.env.local up -d --build
```

Первый раз собирается ~5–15 минут (качает образы, билдит фронты). Дальше — секунды.

Проверить, что всё поднялось:
```powershell
docker compose -f deploy\docker-compose.local.yml ps
```
Должны быть `Up`: db, redis, backend, sync_worker, kiosk, admin, operator, display, nginx.

Проверить в браузере **на самом боксе**: `http://localhost/` — откроется киоск.
С другого устройства LAN: `http://192.168.1.50/`.

Посмотреть, что синк с облаком работает:
```powershell
docker compose -f deploy\docker-compose.local.yml logs --tail 20 sync_worker
```
Должно быть `tick ok — pulled NN catalog rows, pushed N events`.

---

## 5. Устройства по LAN

| Устройство | Открыть в браузере |
|-----------|--------------------|
| Киоск (тач) | `http://192.168.1.50/` |
| Табло (монитор) | `http://192.168.1.50/tablo` |
| Пульт оператора | `http://192.168.1.50/operator` |
| Админка | `http://192.168.1.50/admin` |

Браузер на устройствах лучше запускать в режиме киоска (Chrome `--kiosk http://192.168.1.50/`).

---

## 6. Если поменялся IP бокса (`BOX_HOST`)

Фронты «зашивают» адрес для WebSocket при сборке. После смены `BOX_HOST` в `.env.local`:
```powershell
docker compose -f deploy\docker-compose.local.yml --env-file deploy\.env.local up -d --build kiosk admin operator display
```

---

## 7. Автозапуск (чтобы утром само поднималось)

1. **Docker Desktop → Settings → General → ✅ «Start Docker Desktop when you log in»**.
2. Контейнеры уже с политикой `restart: unless-stopped` — после загрузки Docker они стартуют сами.
3. Сделать так, чтобы Windows входил в систему автоматически (если комп выключают на ночь):
   `netplwiz` → снять «Требовать ввод имени пользователя и пароля».

Итог: включили комп утром → Windows логинится → Docker стартует → контейнеры поднимаются. Руками ничего не нужно.

---

## 8. Принтер и Go-агент (на киоск-ПК, НЕ на боксе)

Принтер Xprinter подключён по USB к **киоск-ПК**, не к боксу. На киоск-ПК:
1. Скопировать бинарь агента из `agent/dist/` (или собрать — см. `agent/README`).
2. Агент слушает `http://localhost:8089`, киоск-страница шлёт печать туда.
3. Автозапуск агента — через **Планировщик заданий Windows** (триггер «При входе в систему»).
   Версия агента v0.3.0 уже умеет автозапуск Планировщиком (CP866 + CORS).

> Если принтер на том же компе, что и бокс — агент всё равно ставится на этот же ПК,
> киоск-вкладка открывается локально на нём.

---

## 9. Десктоп-виджет оператора (опционально)

Вместо вкладки браузера оператор может поставить **always-on-top виджет** (висит поверх
других окон). Это `.exe` из `apps/operator-desktop` (собирается в GitHub Actions —
см. `apps/operator-desktop/README.md`).
1. Установить `.exe` на ПК оператора.
2. При первом запуске ввести адрес бокса (`192.168.1.50`).
3. (Опц.) добавить в автозагрузку: `Win+R` → `shell:startup` → положить ярлык.

---

## 10. Обслуживание

```powershell
# логи (все или один сервис)
docker compose -f deploy\docker-compose.local.yml logs --tail 50
docker compose -f deploy\docker-compose.local.yml logs -f backend

# перезапустить всё
docker compose -f deploy\docker-compose.local.yml restart

# остановить / запустить
docker compose -f deploy\docker-compose.local.yml down
docker compose -f deploy\docker-compose.local.yml --env-file deploy\.env.local up -d

# обновить код (если правки в репо)
git pull                       # или заново распаковать ZIP
docker compose -f deploy\docker-compose.local.yml --env-file deploy\.env.local up -d --build

# бэкап локальной БД (раз в день желательно)
docker compose -f deploy\docker-compose.local.yml exec db pg_dump -U queue queue_system > backup_$(Get-Date -Format yyyyMMdd).sql
```

---

## 11. Если что-то не работает

| Симптом | Что проверить |
|---------|---------------|
| Сайт не открывается с других устройств | Порт 80 открыт в брандмауэре (профиль «Частная»); правильный `BOX_IP`; устройства в той же сети |
| `http://localhost/` тоже не открывается | `docker compose ... ps` — все ли `Up`; `logs nginx` и `logs backend` |
| Каталог пустой (нет услуг) | Был ли интернет на первом старте? `logs sync_worker` — тянет ли каталог; иначе разово `SEED_ON_START=1` |
| Не печатает | Go-агент запущен на киоск-ПК (`http://localhost:8089`)? принтер включён? |
| Синк не идёт | `logs sync_worker` — `sync failed` значит нет связи с облаком или неверный `SYNC_TOKEN` (должен совпадать с прод) |
| Голос не звучит | Колонки подключены к табло-ПК; в браузере был клик (autoplay); громкость |
| После смены IP не коннектится WS | Пересобрать фронты (§6) |

---

## Кратко (шпаргалка)

```powershell
# один раз: Docker Desktop + статический IP + порт 80
copy deploy\.env.local.example deploy\.env.local   # заполнить BOX_HOST, SYNC_TOKEN, пароли
docker compose -f deploy\docker-compose.local.yml --env-file deploy\.env.local up -d --build
# открыть http://<BOX_IP>/
```
