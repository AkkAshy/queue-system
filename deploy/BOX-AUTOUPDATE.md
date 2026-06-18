# Автообновление локального бокса (без флешки)

Бокс **тянет готовые образы из GHCR** — ничего не собирает. Поток:

```
git push origin main
      │
      ▼
GitHub Actions (.github/workflows/build-images.yml)
  собирает 6 образов → ghcr.io/akkashy/ndpi-{backend,kiosk,admin,operator,display}
      │
      ▼
Watchtower на боксе (раз в 2 мин) видит новый :latest → перекачивает → перезапускает
```

Образы **переносимые**: `APP_BASE_PATH` зашит по приложению, а WS-адрес берётся из
origin страницы в рантайме — поэтому один и тот же образ работает на любом IP бокса
и на проде. Менять `BOX_HOST` без пересборки можно.

## Разовая настройка бокса

1. Поставить Docker + docker compose.
2. Залогиниться в GHCR (нужен GitHub PAT со scope `read:packages`):
   ```sh
   docker login ghcr.io -u <github-user>
   # пароль = PAT (read:packages)
   ```
3. Положить на бокс папку `deploy/` (compose + nginx/ + media/) и создать `.env.box`:
   ```sh
   cp deploy/.env.box.example deploy/.env.box   # заполнить пароли/SYNC_TOKEN/BOX_HOST
   ```
4. Поднять:
   ```sh
   docker compose -f deploy/docker-compose.box.yml --env-file deploy/.env.box up -d
   ```
5. Первый сид базы (категории/окна/операторы) — один раз:
   ```sh
   docker compose -f deploy/docker-compose.box.yml --env-file deploy/.env.box \
     exec backend python manage.py load_services_fixture
   ```
   Потом выставить `SEED_ON_START=0` в `.env.box` (чтобы рестарты не пересидели;
   дальше каталог держит актуальным sync_worker из облака).

После этого **обновления прилетают сами** — watchtower следит за GHCR. Откатывать
руками не нужно.

## Полезные команды (на боксе)

```sh
# обновить прямо сейчас (не ждать watchtower)
sh deploy/box-update.sh

# логи автообновления
docker logs -f ndpi-queue-box-watchtower-1

# статус
docker compose -f deploy/docker-compose.box.yml --env-file deploy/.env.box ps
```

## Что НЕ трогает watchtower
Только контейнеры с меткой `com.centurylinklabs.watchtower.enable=true`
(backend, sync_worker, kiosk, admin, operator, display). `db`, `redis`, `nginx`,
сам `watchtower` — не обновляются автоматически (данные и роутинг стабильны).

## Замечания
- GHCR-пакеты приватные → нужен `docker login` (п.2). Либо сделать пакеты public
  в настройках репозитория — тогда логин не нужен, но образы видны всем.
- Go-агент печати (Windows, офисный киоск-ПК) обновляется отдельно — он не в Docker.
- TV-APK (`tv-board/`) тоже отдельно — пересобрать и переустановить при изменениях.
