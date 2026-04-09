# Travel Admin

Админ-панель для travel-проекта на `React + Bootstrap`.

## Что уже заложено

- dashboard с общей сводкой по пользователям, городам, POI, жалобам и модерации;
- CRUD-экраны для основных сущностей;
- отдельные экраны для жалоб и модерации;
- `ML Lab` для работы с `travel-ml`;
- настройки адресов сервисов и JWT прямо из интерфейса;
- локальный demo-store для быстрой разработки без поднятого backend.

## Что удалось подтвердить по backend

`travel-back` разнесен по двум веткам и стыкуется через внешнюю docker-сеть `travel-net`.

- `feature/poi-service`: `city-service`, `poi-service`, `review-service`, `ml-poi-worker-service`
- `feature/route-service`: `auth-service`, `route-service`, `graph-importer`, `notification-service`, `personalization-service`

Основные live URL по compose:

- `auth-service`: `http://localhost:8084/api`
- `city-service`: `http://localhost:8082/api/cities`
- `poi-service`: `http://localhost:8081/api/poi`
- `review-service`: `http://localhost:8083/api/reviews`
- `route-service`: `http://localhost:8087`
- `ml-poi-worker-service`: `http://localhost:8000`

## Запуск

```bash
npm install
npm run dev
```

Сборка:

```bash
npm run build
```

## Docker

```bash
docker build -t travel-admin .
docker run --rm -p 3000:80 --network travel-net travel-admin
```

Если открываешь админку в браузере с хоста, в настройках панели используй `localhost`-адреса сервисов. Если фронтенд сам работает контейнером внутри `travel-net`, можно переключить URL на имена контейнеров.
