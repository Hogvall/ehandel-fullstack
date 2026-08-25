# E-handel Marcus Högvall

En fullstack e-handel byggd som skoluppgift i kursen Systemutveckling (fsu25d). Applikationen låter kunder bläddra produkter, lägga varor i varukorg, genomföra ett simulerat köp och skapar en riktig order i databasen. Administratörer kan hantera produktsortimentet och följa upp inkomna ordrar.

**Live:** https://ehandel-frontend-hogvall.onrender.com

## Teknikstack

| Del | Teknik |
|---|---|
| Frontend | React (Vite), React Router |
| Backend | Node.js, Express |
| Databas | MySQL |
| Autentisering | JWT (JSON Web Tokens), bcrypt |
| Deploy | Render (frontend + backend), Railway (databas) |

## Arkitektur

Applikationen är uppdelad i tre separata delar som kommunicerar över HTTP:


Frontend gör inga direkta databasanrop; all kommunikation med databasen går genom backendens API. Det håller databasinloggningsuppgifter, affärslogik och validering på servern, där de inte kan manipuleras av en användare i webbläsaren.

## Databaskommunikation

Backend kommunicerar med MySQL via paketet `mysql2/promise`, med en **connection pool** (`db.js`) i stället för en enda uppkoppling. Det gör att flera samtidiga förfrågningar kan hanteras parallellt utan att vänta på varandra.

All data som kommer från användaren (formulär, URL-parametrar) skickas till databasen med **parametriserade frågor** (`?`-platshållare), aldrig genom att sätta ihop SQL-strängar direkt. Det skyddar mot SQL-injection.

Vid ordersläggning (`POST /api/orders`) används en **databastransaktion**: att skapa ordern, skapa dess orderrader och minska produkternas lagersaldo sker som en enda odelbar operation. Om något steg misslyckas, till exempel otillräckligt lager, rullas hela transaktionen tillbaka, så databasen aldrig hamnar i ett halvfärdigt tillstånd.

### Databasdesign

Databasen är uppbyggd enligt ett ER-diagram framtaget innan kodningen påbörjades (se `docs/databasdiagram.md`). Den speglar de faktiska relationerna i verksamheten:

- `users`: kunder och administratörer i samma tabell, skilda åt med en `role`-kolumn
- `products` och `categories` kopplas via en egen korstabell (`product_categories`), eftersom en produkt kan tillhöra flera kategorier
- `orders` och `order_items` är separerade så att en order kan innehålla flera olika produkter i valfritt antal
- `order_items.price_at_purchase` sparar priset vid köptillfället separat från produktens aktuella pris, eftersom en senare prisändring inte ska påverka historiska ordrar
- `cart_items` kopplar en inloggad användares varukorg till databasen (VG-krav)

Samtliga foreign keys har `ON DELETE CASCADE` där det är semantiskt korrekt, till exempel att en borttagen order tar bort sina orderrader, men inte där historik ska bevaras, till exempel att en borttagen produkt inte får radera gamla orderrader som refererar till den.

## Funktioner

**Kund (utan inloggning):**
- Bläddra produkter
- Lägga produkter i varukorg (lagras lokalt i webbläsaren)
- Genomföra ett simulerat köp

**Kund (inloggad):**
- Varukorgen sparas i databasen och följer med mellan enheter och sessioner
- Registrering och inloggning med krypterat lösenord

**Administratör:**
- Skapa, redigera och ta bort produkter
- Se alla ordrar och ändra deras status (Beställd, Behandlas, Levererad eller Återbetald)
- Endast tillgängligt för inloggade användare med rollen `admin`, skyddat både i gränssnittet och i API:et

## Autentisering och säkerhet

Lösenord lagras aldrig i klartext. De hashas med `bcrypt` innan de sparas i databasen. Vid inloggning jämförs det inskickade lösenordet mot den sparade hashen; hashen kan aldrig "packas upp" tillbaka till lösenordet.

Vid lyckad inloggning utfärdas en **JWT-token**, signerad med en hemlig nyckel som bara servern känner till. Klienten skickar token i `Authorization`-headern vid varje anrop som kräver inloggning. En egen middleware (`middleware/auth.js`) verifierar token och kontrollerar användarens roll innan skyddade routes (produkthantering, orderhantering) tillåts köra.

## Kravanpassning

Projektets databasdesign och applikationsstruktur togs fram utifrån en kravställning (se `docs/`), i tre steg innan kodning påbörjades:

1. **ER-diagram**: modellerade entiteter och relationer utifrån vilka funktioner (produktlista, kundvagn, ordrar, inloggning) som krävdes
2. **Sitemap**: kartlade vilka sidor applikationen behövde, vilket i sin tur styrde React-routingen
3. **Tidsplan**: bröt ner arbetet i hanterbara faser med tydliga milstolpar

Design och datamodell justerades löpande under utvecklingen när verkliga krav krävde det. Till exempel infördes en separat korstabell för relationen mellan produkt och kategori när kravet att en produkt kan tillhöra flera kategorier konkretiserades.

## Köra projektet lokalt

**Förutsättningar:** Node.js, en MySQL-server.

```bash
# Backend
cd backend
npm install
cp .env.example .env   # fyll i egna databasuppgifter
npm run dev

# Frontend (nytt terminalfönster)
cd frontend
npm install
npm run dev
```

Databastabellerna skapas genom att köra `backend/schema.sql` mot din MySQL-databas.