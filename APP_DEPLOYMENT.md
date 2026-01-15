# App Deployment (Coolify)

Ten dokument opisuje kroki potrzebne do uruchomienia aplikacji na nowym srodowisku w Coolify.

## 1) Wymagania
- Dostep do serwera z Coolify.
- Repozytorium Git: `kameel77/talentpilot`.
- Domena dla backendu i frontendu (moze byc sslip.io).

## 2) Uruchomienie lokalne (Development)

> [!NOTE]
> Nawet jeśli uruchamiasz kod backendu i frontendu bezpośrednio na systemie (bez Dockera), nadal potrzebujesz działającej bazy danych (PostgreSQL) i Redis. Najprościej uruchomić tylko te usługi za pomocą Dockera:
> ```sh
> docker compose up -d postgres redis
> ```

### Backend
1. Przejdź do folderu `backend`.
2. (Zalecane) Utwórz i aktywuj wirtualne środowisko:
   ```sh
   python -m venv venv
   source venv/bin/activate  # macOS/Linux
   # lub: venv\Scripts\activate  # Windows
   ```
3. Zainstaluj zależności:
   ```sh
   pip install -r requirements.txt
   ```
4. Uruchom migracje bazy danych (po uruchomieniu kontenera postgres):
   ```sh
   alembic upgrade head
   ```
5. Uruchom serwer:
   ```sh
   uvicorn main:app --reload --port 8000
   ```

### Frontend
1. Przejdź do folderu `frontend`.
2. Zainstaluj zależności (`npm install`).
3. Uruchom serwer:
   ```sh
   npm run dev
   ```

### Rozwiązywanie konfliktów portów
Jeśli port (np. 3000 lub 8000) jest zajęty:

1. **Znajdź PID procesu:**
   ```sh
   lsof -i :3000
   ```
2. **Zabij proces:**
   ```sh
   kill -9 <PID>
   ```

## 3) Konfiguracja aplikacji w Coolify
1. Create new Application (Build Pack: Docker Compose).
2. Repository: `kameel77/talentpilot`.
3. Branch: `dev`.
4. Base Directory: `/`.
5. Docker Compose Location: `/docker-compose.prod.yml`.
6. Domains:
   - Backend: `https://<backend-domain>`
   - Frontend: `https://<frontend-domain>`
7. Zapisz konfiguracje i zrob **Redeploy (force)**.

## 4) Zmienne srodowiskowe (Environment Variables)
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

## 5) Pierwszy deploy i migracje bazy
Po pierwszym starcie backendu uruchom migracje Alembic:

```sh
docker ps --format "table {{.Names}}\t{{.Image}}" | grep backend
# skopiuj nazwe kontenera backendu

docker exec -it <BACKEND_CONTAINER> bash -lc "cd /app && alembic upgrade head"
```

## 6) Typowe problemy i rozwiazania
- **Port zajety (Bind for 0.0.0.0:8000 failed)**
  - Zmien `BACKEND_PORT` na wolny port.

- **Frontend nie widzi API**
  - Sprawdz `NEXT_PUBLIC_API_URL` i domeny w Coolify.

- **CORS 400 na OPTIONS**
  - Sprawdz `CORS_ORIGINS` w env.
  - Upewnij sie, ze compose nie nadpisuje wartosci (w prod compose jest `${CORS_ORIGINS:-...}`).

- **Blad `relation "users" does not exist`**
  - Brak migracji: uruchom `alembic upgrade head`.

- **Blad `pg_config executable not found` (macOS)**
  - Masz zainstalowanego Pythona 3.13, który może wymagać kompilacji sterownika `psycopg2`.
  - Rozwiązanie:
    1. Zainstaluj `libpq`: `brew install libpq`
    2. Jeśli instalacja nadal zgłasza błędy, ustaw zmienne środowiskowe w tej sesji terminala:
       ```sh
       export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
       export LDFLAGS="-L/opt/homebrew/opt/libpq/lib"
       export CPPFLAGS="-I/opt/homebrew/opt/libpq/include"
       ```
    3. Spróbuj ponownie: `pip install -r requirements.txt`

- **Blad `can't find Rust compiler` / `Building wheel for tiktoken`**
  - Python 3.13 wymaga najnowszych wersji bibliotek, aby pobrać gotowe pliki (wheels) bez konieczności kompilacji (która wymaga Rusta).
  - Rozwiązanie: Upewnij się, że masz najnowszego `pip` i używasz zaktualizowanego `requirements.txt`.
    ```sh
    pip install --upgrade pip
    pip install -r requirements.txt
    ```

- **Blad `AssertionError: Class ... TypingOnly but has additional attributes`**
  - Krytyczny błąd kompatybilności SQLAlchemy z Python 3.13. Wymaga wersji `sqlalchemy>=2.0.31`.
  - Rozwiązanie: Upewnij się, że masz zaktualizowany `requirements.txt` i zainstaluj ponownie:
    ```sh
    pip install -r requirements.txt
    ```

- **Blad `FATAL: role "talentpilot" does not exist` lub problem z portem 5432 (macOS)**
  - Prawdopodobnie masz zainstalowanego lokalnego PostgreSQL na Macu, który zajmuje domyślny port.
  - Rozwiązanie:
    1. Sprawdź co zajmuje port: `lsof -i :5432`
    2. Najprościej: Zmień port mapowania w `docker-compose.yml` lub glównym `.env` na `5433:5432`.
    3. Zaktualizuj `DATABASE_URL` w `backend/.env`, aby używał portu `5433` i adresu `127.0.0.1`.

## 7) Weryfikacja
- Backend: `https://<backend-domain>/health` powinno zwracac `status: healthy`.
- Frontend: `https://<frontend-domain>` powinien sie ladowac bez bledow w konsoli.

## 8) Utrzymanie danych
Dane w bazie sa w wolumenie Dockera. Kolejne deploye ich nie usuwaja.
Dane znikna tylko po usunieciu wolumenu (np. `docker compose down -v`).
