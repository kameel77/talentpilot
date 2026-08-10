# Uruchomienie Stripe — staging (test) i produkcja (live)

**Kontekst:** `docs/BRIEF_BILLING_TRIAL.md`. Kod backendu jest gotowy — ten dokument opisuje wyłącznie konfigurację środowisk. Nic tutaj nie wymaga zmian w repo poza ustawieniem zmiennych środowiskowych.

**Zasada nadrzędna:** staging używa **wyłącznie kluczy testowych** (`sk_test_…`, `whsec_…` z trybu test), produkcja **wyłącznie live** (`sk_live_…`). Klucze nigdy nie trafiają do repo — tylko do sekretów środowiska.

---

## 1. Model rozliczeń w skrócie

| Element | Zachowanie |
|---|---|
| Okres testowy | Nadawany **przy rejestracji**, bez karty. 14 dni domyślnie, **30 dni dla coacha** (`BILLING_TRIAL_DAYS_*`). |
| W trakcie triala | Brak limitów — `plan_limits.py` traktuje organizację jako nielimitowaną, dopóki `trial_ends_at` jest w przyszłości. |
| Po trialu (plan Free) | **0 organizacji klienckich**, **maks. 3 klientów indywidualnych**. Odczyty nigdy nie są limitowane. |
| Checkout w trakcie triala | Stripe dostaje **pozostałe** dni triala, nie nowe 14/30 — nie da się skumulować dwóch darmowych okresów. |
| Źródło prawdy | Stripe. Kolumny w naszej bazie to cache aktualizowany webhookami. |

Karta przy rejestracji jest sterowana flagą `BILLING_REQUIRE_CARD_AT_SIGNUP` (domyślnie `false`) — zmiana nie wymaga deployu nowej logiki, tylko restartu z inną zmienną.

---

## 2. Produkty i ceny (Stripe Dashboard)

Zakładam, że produkty już istnieją. Wymagane są **cztery ceny cykliczne** (recurring), po dwie na plan:

| Plan | Interwał | Zmienna |
|---|---|---|
| Pro | miesięczny | `STRIPE_PRICE_PRO_MONTHLY` |
| Pro | roczny | `STRIPE_PRICE_PRO_YEARLY` |
| Studio | miesięczny | `STRIPE_PRICE_STUDIO_MONTHLY` |
| Studio | roczny | `STRIPE_PRICE_STUDIO_YEARLY` |

Wymagania:

- waluta **PLN** (BLIK off-session działa tylko w PLN, limit 2000 zł na obciążenie),
- typ **recurring**, nie one-time,
- ID zaczyna się od `price_…` (nie `prod_…` — częsty błąd),
- ceny w trybie **test** i **live** mają **różne ID**; nie da się użyć testowego ID na produkcji.

Kwoty nie są nigdzie zapisane w repo — aplikacja odczytuje je ze Stripe przez `GET /api/billing/status` i wyświetla dokładnie to, co realnie zostanie pobrane.

---

## 3. Webhooki

### 3.1 Endpoint

Aplikacja wystawia **jeden** endpoint:

```
POST {BACKEND_URL}/api/billing/webhook
```

Nagłówek podpisu: `Stripe-Signature` (obsługiwany automatycznie).

### 3.2 Zdarzenia do zasubskrybowania

Dokładnie te cztery — nic więcej nie jest przetwarzane, a nadmiarowe zdarzenia tylko generują szum:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

### 3.3 Staging (tryb test)

1. Stripe Dashboard → przełącz na **Test mode** (przełącznik w prawym górnym rogu).
2. *Developers → Webhooks → Add endpoint*.
3. URL: `https://api.staging.talentpilot.io/api/billing/webhook` (podstaw realny adres backendu staginga — **nie** adres frontendu).
4. Zaznacz cztery zdarzenia z §3.2.
5. Po utworzeniu skopiuj **Signing secret** (`whsec_…`) → `STRIPE_WEBHOOK_SECRET` w env staginga.

Dopóki staging nie ma publicznego adresu, ten sam efekt daje Stripe CLI z lokalnym backendem:

```bash
stripe login
stripe listen --forward-to localhost:8000/api/billing/webhook
# wypisze whsec_… → wstaw do STRIPE_WEBHOOK_SECRET i zrestartuj backend
stripe trigger checkout.session.completed
```

### 3.4 Produkcja (tryb live)

Powtórz §3.3 z przełącznikiem w pozycji **Live mode** i adresem produkcyjnym. Otrzymasz **inny** `whsec_…` — sekret testowy nie zweryfikuje podpisu live i każdy webhook wróci z 400.

### 3.5 Weryfikacja

W Stripe: *Developers → Webhooks → wybrany endpoint → Recent deliveries*. Poprawna dostawa to **HTTP 200**.

| Kod | Znaczenie |
|---|---|
| 200 | OK |
| 400 | Zły podpis — `STRIPE_WEBHOOK_SECRET` nie pasuje do endpointu (najczęściej sekret z trybu test na live lub odwrotnie) |
| 404 | `BILLING_PROVIDER` ≠ `stripe` w tym środowisku |
| 5xx | Błąd aplikacji — sprawdź logi backendu |

Webhooki są **idempotentne** (tabela `processed_billing_events`), więc ponowne wysłanie tego samego zdarzenia ze Stripe jest bezpieczne i nie zmieni stanu po raz drugi.

---

## 4. Zmienne środowiskowe

### Staging

```bash
ENVIRONMENT=staging
BILLING_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_test_…
STRIPE_WEBHOOK_SECRET=whsec_…            # z endpointu w trybie TEST
STRIPE_PRICE_PRO_MONTHLY=price_…         # ceny z trybu TEST
STRIPE_PRICE_PRO_YEARLY=price_…
STRIPE_PRICE_STUDIO_MONTHLY=price_…
STRIPE_PRICE_STUDIO_YEARLY=price_…
BILLING_TRIAL_DAYS_DEFAULT=14
BILLING_TRIAL_DAYS_COACH=30
BILLING_REQUIRE_CARD_AT_SIGNUP=false
FRONTEND_URL=https://staging.talentpilot.io
```

### Produkcja

Identycznie, ale `ENVIRONMENT=production`, klucze `sk_live_…`, sekret i ceny z trybu **live**, oraz `FRONTEND_URL=https://app.talentpilot.io`.

`FRONTEND_URL` buduje adresy powrotu z Checkoutu (`/dashboard?checkout=success|cancelled`). Zły adres = klient po płatności ląduje w innym środowisku.

**Zabezpieczenia w kodzie, o których warto wiedzieć:**

- `BILLING_PROVIDER=fake` przy `ENVIRONMENT=production` **nie wystartuje** — aplikacja rzuci błąd konfiguracji przy starcie.
- `BILLING_PROVIDER=stripe` bez kompletu kluczy również nie wystartuje. To celowe: lepiej nie wstać, niż wstać i cicho nie brać płatności.
- Endpointy `/api/dev/billing/*` nie są w ogóle rejestrowane w produkcji.

---

## 5. Kolejność wdrożenia

1. **Staging z `BILLING_PROVIDER=fake`** — przeklikaj ścieżkę bez Stripe (stub `/dev/checkout`). Sprawdza integrację UI, nie Stripe.
2. **Staging z `BILLING_PROVIDER=stripe` + klucze test** — pełna ścieżka na kartach testowych.
3. **Produkcja z kluczami live** — dopiero gdy §6 przechodzi w całości na stagingu.

Migracje bazy: nie trzeba nic dodatkowo uruchamiać poza standardowym `alembic upgrade head` — kolumny billingowe i `processed_billing_events` już istnieją.

---

## 6. Checklista weryfikacyjna (staging, tryb test)

Karty testowe: `4242 4242 4242 4242` (sukces), `4000 0000 0000 9995` (odrzucona), dowolna przyszła data i CVC.

- [ ] Rejestracja coacha → w Ustawieniach → Rozliczenia widać „Okres testowy", **30 dni**.
- [ ] Rejestracja zwykłego konta → **14 dni**.
- [ ] W trakcie triala można dodać organizację klienta (brak 402).
- [ ] Ręczne cofnięcie `trial_ends_at` w bazie → dodanie organizacji zwraca **402** i pojawia się modal „Organizacje klienckie wymagają płatnego planu".
- [ ] Na Free czwarty klient indywidualny → **402** z modalem o limicie 3.
- [ ] Zakładka Rozliczenia pokazuje ceny **zgodne z Dashboardem** (odczyt ze Stripe, nie z kodu).
- [ ] Checkout kartą testową → powrót na `/dashboard?checkout=success` z zielonym banerem.
- [ ] W Stripe: `checkout.session.completed` → **200**; w bazie ustawione `billing_customer_id`, `billing_subscription_id`, `payment_method_last4`.
- [ ] Subskrypcja rozpoczęta **w trakcie** triala ma w Stripe `trial_end` równy pozostałym dniom, nie nowym 14/30.
- [ ] „Zarządzaj płatnością" otwiera Customer Portal.
- [ ] Anulowanie w portalu → `customer.subscription.deleted` → plan wraca na Free.
- [ ] Karta odrzucona → `invoice.payment_failed` → status `past_due` i czerwony baner w aplikacji.
- [ ] Ponowne wysłanie tego samego zdarzenia ze Stripe (*Resend*) → 200 i **brak** zmiany stanu.

---

## 7. Czego jeszcze nie ma

- **Fakturownia / KSeF** — zero kodu. Integracja jest natywna po stronie Fakturowni (sama dopina webhook do Stripe), do zrobienia osobno; patrz `BRIEF_BILLING_TRIAL.md` §7.
- **Automatyczne wygaszanie triala** — organizacja z przeterminowanym `trial_ends_at` traci limity natychmiast (sprawdzane przy każdym zapisie), ale jej `subscription_status` pozostaje `trialing`, dopóki nie przyjdzie webhook. Kosmetyka statusu, nie luka w limitach.
- **Proration przy zmianie planu** — obsługuje Customer Portal Stripe; nie mamy własnego UI zmiany planu w trakcie okresu.
