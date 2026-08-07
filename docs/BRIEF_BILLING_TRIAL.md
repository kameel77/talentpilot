# Brief #3 — Billing (Stripe + Fakturownia), karta i okres testowy

**Status:** gotowy do wdrożenia po potwierdzeniu §2 i konsultacji księgowej z §7
**Data:** 2026-08-07
**Kontekst:** `COMMERCIALIZATION_STRATEGY.md` §5 i §7 — billing jest pozycją nr 1 na liście „must-have przed pobraniem pierwszej złotówki". W repo **nie ma dziś żadnej infrastruktury płatności**.
**Dostawca:** Stripe (płatności i subskrypcje) + Fakturownia (faktury i KSeF). Wariant PayU rozważony i odłożony — uzasadnienie w §9.

---

## 1. Decyzje przyjęte

| Decyzja | Wybór |
|---|---|
| Dostawca płatności | **Stripe** |
| Faktury | **Fakturownia** (natywna integracja ze Stripe) |
| Karta | **Wymagana przy starcie okresu testowego** |
| Koniec triala | Auto-obciążenie; **downgrade do Free** przy anulowaniu lub nieudanej płatności |
| Długość | **14 dni domyślnie**, **90 dni nadawane ręcznie** dla design partnerów |

---

## 2. Dlaczego ta konfiguracja jest właściwa na tym etapie

Rozważaliśmy PayU. Weryfikacja dokumentacji obu dostawców pokazała, że Stripe + Fakturownia usuwa **trzy z czterech** przeszkód, które przy PayU trzeba było obejść:

| Problem | PayU | Stripe + Fakturownia |
|---|---|---|
| Karta bez obciążenia na start triala | brak udokumentowanego odpowiednika — trzeba było weryfikacji groszowej albo obejścia 3DS | **Checkout w trybie subskrypcji z trialem** — natywne, karta zapisana, zero obciążenia |
| Silnik subskrypcji (odnowienia, dunning, portal) | **budujemy sami** (+1–2 tyg.) | gotowy w Stripe Billing |
| Faktury VAT + KSeF | brak — ręcznie albo własna integracja | **Fakturownia sama dodaje webhook do Stripe**, wystawia fakturę przy każdej płatności i wysyła do KSeF |
| Czas uruchomienia | tokeny `MULTI` i usługa cykliczna wymagają włączenia przez opiekuna konta | self-serve, test mode od razu |

Kontrargument rynkowy za PayU — BLIK i zaufanie polskiego kupującego — **też się rozbroił**: Stripe obsługuje BLIK, a dla płatności powtarzalnych ma BLIK Model O. Ograniczenie: obciążenia off-session muszą być w PLN i **nie mogą przekraczać 2000 zł na transakcję**. Nasze plany (200–500 zł/mies. wg strategii) mieszczą się w tym z dużym zapasem.

Przelewy24 w Stripe obsługuje wyłącznie płatności jednorazowe — dla subskrypcji nieprzydatne, ale też niepotrzebne.

**Wniosek:** to nie jest wybór „gorszego, ale szybszego" rozwiązania. Na tym etapie Stripe + Fakturownia jest jednocześnie prostszy i pełniejszy. Decyzja o rozbudowie później (§9) zostaje otwarta i tania, jeśli utrzymamy izolację dostawcy opisaną w §5.

---

## 3. Rekomendacja co do umiejscowienia kroku z kartą

Karta „przy starcie triala" ma dwa możliwe miejsca:

**(a) zaraz po rejestracji** — literalne odczytanie decyzji;
**(b) po pierwszym momencie wartości** — coach zakłada konto, przechodzi kreator, wgrywa pierwszy raport i **widzi profil klienta**, a dopiero wtedy: „Aby korzystać dalej, dodaj kartę — 14 dni bez opłat".

**Rekomenduję (b)**, i jest to świadomy sprzeciw wobec dosłownego brzmienia decyzji.

Przez trzy ostatnie iteracje systematycznie usuwaliśmy friction z rejestracji: nazwa firmy poszła za moment wartości, e-mail klienta stał się opcjonalny, imię wyciągamy z PDF-a. Formularz karty dokładnie w tym miejscu cofa cały ten wysiłek — i to polem, które budzi znacznie większy opór niż nazwa firmy.

Wariant (b) zachowuje **całe** wymaganie (bez karty nikt nie wejdzie głębiej), a przesuwa je o trzy minuty — za moment, w którym coach zobaczył, że produkt działa. Koszt techniczny obu wariantów jest identyczny.

Kontrargument, który uznaję: przy dziesięciu coachach walidacyjnych karta na wejściu odfiltrowuje „turystów" i daje czystszy sygnał. Jeśli to przeważa — wariant (a), ale z jawnym komunikatem przy polu karty: „Nie pobierzemy nic przez 14 dni. Anulujesz jednym kliknięciem."

---

## 4. Model danych

Subskrypcja siedzi na **Organization** (workspace coacha), nie na User. W Etapie 2 (B2B2B) płaci organizacja klienta per seat — trzymanie subskrypcji na organizacji od początku oznacza jeden model dla obu etapów zamiast migracji za pół roku.

```python
class PlanTier(str, enum.Enum):
    FREE = "free"; PRO = "pro"; STUDIO = "studio"

class SubscriptionStatus(str, enum.Enum):
    TRIALING = "trialing"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELED = "canceled"
    FREE = "free"
```

Nowe kolumny na `organizations`:

| Kolumna | Typ | Uwagi |
|---|---|---|
| `plan` | Enum(PlanTier) | default `FREE` |
| `subscription_status` | Enum(SubscriptionStatus) | default `FREE` |
| `trial_ends_at` | DateTime(tz) nullable | **ręcznie nadawane dla design partnerów** |
| `current_period_end` | DateTime(tz) nullable | cache ze Stripe |
| `billing_customer_id` | String(64) nullable, unique | id klienta u dostawcy |
| `billing_subscription_id` | String(64) nullable, unique | id subskrypcji u dostawcy |
| `payment_method_last4` | String(4) nullable | tylko do wyświetlenia |
| `tax_id` | String(32) nullable | NIP — **potrzebny Fakturowni**, patrz §7 |

Nazwy kolumn celowo **bez prefiksu `stripe_`** — patrz §5.

Migracja Alembic z działającym `downgrade()`. Istniejące organizacje: `plan=FREE`, `subscription_status=FREE` — **żadna nie zostaje odcięta** przy wdrożeniu.

---

## 5. Izolacja dostawcy — jedyny element „na zapas"

Wszystkie wywołania Stripe zamknięte w `backend/services/billing/stripe_provider.py` za wąskim interfejsem (`create_checkout_session`, `cancel_subscription`, `get_portal_url`, `parse_webhook`). Routery i logika domenowa **nie importują `stripe` bezpośrednio**.

To nie jest przedwczesna abstrakcja — to jedno miejsce zamiast rozsypanych wywołań po routerach, koszt praktycznie zerowy. Płaci się samo przy każdym teście (łatwy mock) i przy ewentualnym dołożeniu PayU (§9).

**Czego nie robić:** nie budować pełnej warstwy „multi-provider" z fabrykami i konfiguracją per organizacja. Jeden dostawca, jeden moduł, wąski interfejs.

---

## 6. Stripe — zakres integracji

- **Checkout w trybie `subscription`** z `trial_period_days` i `payment_method_collection: "always"` — realizuje dokładnie decyzję „karta teraz, obciążenie po trialu". Nie budować własnego formularza karty: PCI i 3DS/SCA (obowiązkowe w EU) załatwia hosted checkout.
- **Metody płatności:** karta + **BLIK (Model O)** dla rynku PL. Limit 2000 zł na obciążenie off-session — nasze plany mieszczą się z zapasem, ale trzeba to udokumentować w kodzie, żeby przy przyszłym planie enterprise ktoś się nie zdziwił.
- **Customer Portal** do zmiany karty, anulowania i historii płatności — zamiast budować własny ekran zarządzania.
- **Webhooki** (`/api/billing/webhook`, weryfikacja podpisu obowiązkowa):
  - `checkout.session.completed` → zapis `billing_customer_id` / `billing_subscription_id`
  - `customer.subscription.updated` → synchronizacja `plan`, `subscription_status`, `current_period_end`
  - `customer.subscription.deleted` → downgrade do Free
  - `invoice.payment_failed` → `PAST_DUE` (dunning obsługuje Stripe; po wyczerpaniu prób sam anuluje → downgrade)
- **Idempotencja:** tabela `processed_billing_events(event_id PK)`. Webhooki przychodzą wielokrotnie; bez tego podwójny downgrade albo podwójne nadanie planu.
- **Źródłem prawdy jest Stripe, nie nasza baza.** Nasze kolumny to cache synchronizowany webhookami. Nigdy nie zmieniać planu na podstawie samego kliknięcia w UI.

---

## 7. Faktury — Fakturownia + KSeF

Fakturownia ma **natywną integrację ze Stripe**: po połączeniu kont sama zakłada webhook i od kolejnej płatności wystawia faktury automatycznie, włącznie z wysyłką do KSeF. Przy subskrypcjach faktura generuje się przy każdym odnowieniu.

To zmienia poprzednią rekomendację: **nie wystawiamy faktur ręcznie**. Integracja jest po stronie konfiguracji, nie kodu.

Co po naszej stronie:

1. **Zbierać NIP** — Stripe Checkout ma `tax_id_collection`; NIP musi trafić do Stripe, żeby Fakturownia wystawiła poprawną fakturę B2B. Zapisujemy też u siebie (`organizations.tax_id`) do wyświetlania.
2. **Adres rozliczeniowy** — `billing_address_collection: "required"`.
3. **Zweryfikować przepływ na jednej realnej transakcji** przed launchem — czy faktura ma NIP, poprawną stawkę i trafia do KSeF.

**⚠️ Do potwierdzenia z księgowym przed uruchomieniem** (nie zgaduję — to obszar prawny):
- harmonogram obowiązkowego KSeF i co on oznacza dla sprzedaży subskrypcyjnej,
- stawka VAT i moment powstania obowiązku podatkowego przy subskrypcji,
- OSS przy sprzedaży poza PL, odwrotne obciążenie w B2B UE,
- czy przy sprzedaży zagranicznej Fakturownia obsłuży wymagane warianty dokumentu.

---

## 8. Limity planu, frontend, DoD

### Limity — jedno miejsce, nie rozsiane po routerach

Free (za strategią): **1 organizacja klienta, 5 profili**. `backend/services/plan_limits.py`:

```python
PLAN_LIMITS = {
    PlanTier.FREE:   {"client_orgs": 1, "profiles": 5},
    PlanTier.PRO:    {"client_orgs": None, "profiles": None},
    PlanTier.STUDIO: {"client_orgs": None, "profiles": None},
}
```

Egzekwowane **wyłącznie** w miejscach zapisu: `POST /api/organizations`, `POST /api/invitations/ghost` (obsługuje też import masowy — woła ghost invite per osoba), oraz ścieżka `external`, jeśli tworzy profile.

**Czego nie limitować: odczytu.** Coach po downgrade widzi wszystkich dotychczasowych klientów i wszystkie dane. Blokujemy wyłącznie *dodawanie ponad limit*. Odcięcie danych w środku współpracy z klientem kosztuje reputację w małej, gęstej społeczności — a to jedyny kanał dystrybucji z §6 strategii.

Odpowiedź: HTTP **402** ze strukturalnym `detail` (`{"code": "plan_limit_exceeded", "resource": "profiles", "limit": 5}`), żeby frontend pokazał modal upgrade'u zamiast parsować tekst.

### Frontend

1. **Krok karty** — redirect do Stripe Checkout, powrót na `/dashboard?checkout=success`. Umiejscowienie wg §3.
2. **Pasek triala** — dyskretny, w layoucie dashboardu: „Okres testowy — pozostało X dni". Ton ostrzegawczy przy ≤3 dniach. **Nie modal**, nie blokuje pracy.
3. **Modal limitu** — reakcja na 402: co zablokowane, jaki limit, jeden przycisk do planów.
4. **Ustawienia → Rozliczenia** — plan, status, data odnowienia, końcówka karty, NIP, link do Customer Portal. Nie budujemy własnego zarządzania subskrypcją.
5. **Panel admina** — `trial_ends_at` i override planu, żeby nadać design partnerom 90 dni bez dotykania bazy. Sekcja admina już istnieje (`/dashboard/admin/users`).

### Definition of done

Dowód behawioralny przy każdej pozycji — jak w Brief #2; tu koszt niewykrytego błędu jest finansowy.

1. Migracja aplikuje się i **cofa** czysto; istniejące organizacje dostają `FREE`, żadna nie traci dostępu.
2. Test: przekroczenie limitu Free zwraca **402** ze strukturalnym `detail` — osobno dla `client_orgs` i `profiles`.
3. Test: import masowy N raportów przy limicie 5 tworzy dokładnie 5 profili i zwraca 402 na szóstym, **bez częściowo zapisanego stanu**.
4. Test webhooka: `customer.subscription.deleted` → `FREE`; **ten sam event dwa razy → ten sam stan** (idempotencja).
5. Test: webhook z nieprawidłowym podpisem → 400 i **zero zmian w bazie**.
6. Test: `trial_ends_at` ustawione ręcznie na 90 dni nie jest nadpisywane przez synchronizację.
7. Ścieżka e2e w Stripe test mode: rejestracja → karta → trial → wymuszone zakończenie → obciążenie → `PRO`.
8. Ścieżka anulowania: anulowanie w trialu → koniec okresu → `FREE` → dane widoczne, dodanie 6. profilu zwraca 402.
9. **Weryfikacja faktury na realnej transakcji** (§7 pkt 3) — z NIP-em i potwierdzeniem KSeF.
10. Żaden router nie importuje `stripe` bezpośrednio (grep) — patrz §5.
11. `pytest` zielony, `tsc --noEmit` czysty, parytet kluczy PL/EN.
12. `DEVLOG.md`: subskrypcja na Organization, limity tylko na zapis, izolacja dostawcy, PayU odłożone z uzasadnieniem.
13. **Zdarzenia analityczne**: `checkout_started`, `checkout_completed`, `trial_started`, `trial_ended`, `charge_failed`, `plan_limit_hit`, `downgraded_to_free`. Bez nich nie ocenimy, czy karta przy starcie triala była dobrą decyzją — a to hipoteza do zweryfikowania danymi, nie opinią.

---

## 9. Kiedy wrócić do PayU

Decyzja jest odwracalna i warto zapisać, co miałoby ją odwrócić:

- **Prowizje** okażą się istotnie wyższe niż u PayU przy wolumenie PLN — przy 50 coachach × 250 zł różnica kilku dziesiątych procenta jest nieistotna; przy Etapie 2 i setkach seatów przestaje być.
- **BLIK Model O** okaże się w praktyce zawodny albo limit 2000 zł zacznie uwierać przy planach zespołowych.
- **Etap 2 (B2B2B)** wymusi rozliczenia per seat z polskimi organizacjami, dla których PayU jest naturalniejszym partnerem.

Warunkiem taniej zmiany jest wyłącznie utrzymanie izolacji z §5. Dopóki wywołania dostawcy siedzą w jednym module, dołożenie drugiego to praca w dniach, nie w tygodniach.

---

## Źródła

- [Fakturownia — integracja ze Stripe, automatyczne fakturowanie](https://pomoc.fakturownia.pl/integracja-fakturowni-ze-stripe-automatyczne-fakturowanie-platnosci)
- [Stripe — BLIK payments](https://docs.stripe.com/payments/blik)
- [Stripe — Przelewy24](https://stripe.com/en-th/payment-method/przelewy24)
- [PayU Europe — Recurring Payments](https://developers.payu.com/europe/docs/payment-solutions/cards/recurring/) *(wariant odłożony, §9)*
- [PayU Europe — Card Tokenization](https://developers.payu.com/europe/docs/payment-solutions/cards/tokenization/) *(jw.)*
