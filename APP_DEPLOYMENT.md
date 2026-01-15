# App Deployment (Coolify)

Ten dokument opisuje kroki potrzebne do uruchomienia aplikacji na nowym srodowisku w Coolify.

## 1) Wymagania
- Dostep do serwera z Coolify.
- Repozytorium Git: `kameel77/talentpilot`.
- Domena dla backendu i frontendu (moze byc sslip.io).

## 2) Konfiguracja aplikacji w Coolify
1. Create new Application (Build Pack: Docker Compose).
2. Repository: `kameel77/talentpilot`.
3. Branch: `dev`.
4. Base Directory: `/`.
5. Docker Compose Location: `/docker-compose.prod.yml`.
6. Domains:
   - Backend: `https://<backend-domain>`
   - Frontend: `https://<frontend-domain>`
7. Zapisz konfiguracje i zrob **Redeploy (force)**.

## 3) Zmienne srodowiskowe (Environment Variables)
Ustaw je w Coolify (dla tej aplikacji):

- `BACKEND_PORT=8001` (lub inny wolny port hosta)
- `FRONTEND_PORT=3000`
- `POSTGRES_PORT=5432`
- `REDIS_PORT=6379`
- `NEXT_PUBLIC_API_URL=https://<backend-domain>`
- `CORS_ORIGINS=https://<frontend-domain>,http://localhost:3000`
- `JWT_SECRET=<sekret>`
- `OPENAI_API_KEY=<klucz>`

Uwaga: `CORS_ORIGINS` musi zawierac dokladna domene frontendu.

## 4) Pierwszy deploy i migracje bazy
Po pierwszym starcie backendu uruchom migracje Alembic:

```sh
docker ps --format "table {{.Names}}\t{{.Image}}" | grep backend
# skopiuj nazwe kontenera backendu

docker exec -it <BACKEND_CONTAINER> bash -lc "cd /app && alembic upgrade head"
```

## 5) Typowe problemy i rozwiazania
- **Port zajety (Bind for 0.0.0.0:8000 failed)**
  - Zmien `BACKEND_PORT` na wolny port.

- **Frontend nie widzi API**
  - Sprawdz `NEXT_PUBLIC_API_URL` i domeny w Coolify.

- **CORS 400 na OPTIONS**
  - Sprawdz `CORS_ORIGINS` w env.
  - Upewnij sie, ze compose nie nadpisuje wartosci (w prod compose jest `${CORS_ORIGINS:-...}`).

- **Blad `relation "users" does not exist`**
  - Brak migracji: uruchom `alembic upgrade head`.

## 6) Weryfikacja
- Backend: `https://<backend-domain>/health` powinno zwracac `status: healthy`.
- Frontend: `https://<frontend-domain>` powinien sie ladowac bez bledow w konsoli.

## 7) Utrzymanie danych
Dane w bazie sa w wolumenie Dockera. Kolejne deploye ich nie usuwaja.
Dane znikna tylko po usunieciu wolumenu (np. `docker compose down -v`).
