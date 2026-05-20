# DOOMSHOP-music

> Laravel + Vue alapú zenei webshop vizsgaremek

## Tartalom
- [Projekt áttekintés](#projekt-áttekintés)
- [Fő funkciók](#fő-funkciók)
- [Technológiai stack](#technológiai-stack)
- [Gyors indítás](#gyors-indítás)
- [Dokumentációs fájlok](#dokumentációs-fájlok)
- [Könyvtárstruktúra](#könyvtárstruktúra)

## Projekt áttekintés
A **DOOMSHOP-music** egy online zenei webshop alkalmazás, amelyben:
- a felhasználók böngészhetik a zenéket, kosárba tehetik és megvásárolhatják azokat,
- az adminisztrátorok kezelik a katalógust és az adatokat.

A projekt megfelel a vizsgakövetelményeknek:
- RESTful backend + frontend kliens,
- CRUD műveletek,
- autentikáció és jogosultságkezelés,
- dokumentáció és tesztelési anyagok.

## Fő funkciók
- Regisztráció / login / logout
- Szerepkör alapú hozzáférés (admin, customer)
- Track, artist, genre, album kezelése
- Track preview és audio fájlkezelés
- Kosár és checkout folyamat
- Ajánlók és live show/mix oldalak

## Technológiai stack
| Réteg | Technológia |
|---|---|
| Backend | Laravel 12, PHP 8.2+, Sanctum |
| Frontend | Vue 3, Vite, Pinia, Vue Router |
| Adatbázis | MySQL |
| HTTP kliens | Axios |
| UI | Bootstrap |
| Tesztek | PHPUnit, Vitest, Cypress |

## Gyors indítás
### 1) Klónozás
```bash
git clone <repo-url>
cd DOOMSHOP-music
```

### 2) Backend indítás
```bash
cd server
composer install
copy .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan storage:link
php artisan serve
```

### 3) Frontend indítás
Új terminálban:
```bash
cd client
npm install
npm run dev
```

Elérés:
- Frontend: `http://localhost:5173`
- Backend API: `http://127.0.0.1:8000/api`

## Dokumentációs fájlok
- [RADME.md](./RADME.md) - műszaki feltételek, telepítés, futtatás
- [Dokumentáció.md](./Dokumentáció.md) - szakmai/technikai leírás
- [Tesztek.md](./Tesztek.md) - tesztelési dokumentáció
- `Diagram.png` - adatbázis diagram
- `AdatbazisBackup.sql` - adatbázis export

## Könyvtárstruktúra
```text
DOOMSHOP-music/
├── server/
├── client/
├── DokumnetacioKepek/
├── README.md
├── RADME.md
├── Dokumentáció.md
└── Tesztek.md
```
c # javitas
