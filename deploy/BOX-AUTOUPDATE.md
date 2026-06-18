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
2. GHCR-пакеты **публичные** → `docker login` НЕ нужен. (Если решишь держать их
   приватными — тогда `docker login ghcr.io -u <github-user>` с PAT `read:packages`
   и верни монтирование `~/.docker/config.json` в watchtower.)
3. На боксе уже есть заполненный `deploy/.env.local` (тот же, что у build-стека) —
   **используем его, новый env не нужен.** Если бокс с нуля:
   ```sh
   cp deploy/.env.local.example deploy/.env.local   # заполнить пароли/SYNC_TOKEN/BOX_HOST
   ```
4. Поднять:
   ```sh
   docker compose -f deploy/docker-compose.box.yml --env-file deploy/.env.local up -d
   ```
5. Первый сид базы (категории/окна/операторы) — один раз:
   ```sh
   docker compose -f deploy/docker-compose.box.yml --env-file deploy/.env.local \
     exec backend python manage.py load_services_fixture
   ```
   Потом выставить `SEED_ON_START=0` в `.env.local` (чтобы рестарты не пересидели;
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
docker compose -f deploy/docker-compose.box.yml --env-file deploy/.env.local ps
```

## Что НЕ трогает watchtower
Только контейнеры с меткой `com.centurylinklabs.watchtower.enable=true`
(backend, sync_worker, kiosk, admin, operator, display). `db`, `redis`, `nginx`,
сам `watchtower` — не обновляются автоматически (данные и роутинг стабильны).

## Замечания
- GHCR-пакеты **публичные** → бокс тянет без логина. Видимость пакета меняется
  отдельно от репо: профиль GitHub → Packages → `ndpi-*` → Package settings →
  Change visibility → Public (для каждого из 5 образов).
- Go-агент печати (Windows, офисный киоск-ПК) обновляется отдельно — он не в Docker.
- TV-APK (`tv-board/`) тоже отдельно — пересобрать и переустановить при изменениях.
