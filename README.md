# E-handel – integrerad med omvärlden

En webbshop för kläder byggd med React (Vite), Express och MySQL (TiDB), integrerad med en leverantör, Algolia, Stripe, Supabase Storage och PostNord.

**Deployad shop:** https://ehandel-frontend-hogvall.onrender.com
**Backend:** https://fsu25d-systemutveckling-uppgift-1-min-1ssg.onrender.com

> Backend körs på Renders gratisnivå och somnar efter 15 minuters inaktivitet. Första anropet kan ta upp till en minut.

## Kom igång

### Krav
- Node 18 eller senare
- En MySQL-kompatibel databas (lokal MySQL 8 eller TiDB Cloud)
- [Stripe CLI](https://github.com/stripe/stripe-cli/releases) för att testa webhooken lokalt

### 1. Databas
Kör `backend/schema.sql` i din databas. Den skapar databasen `ehandel` och alla tabeller.

### 2. Server
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```
Fyll i `backend/.env` enligt `.env.example`. Servern startar på http://localhost:3000.

### 3. Klient
```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:3000" > .env
npm run dev
```
Klienten startar på http://localhost:5173.

### 4. Nycklar och testkonton
Alla nycklar ligger i `backend/.env` (se `.env.example`).

| Tjänst | Konto | Variabler |
|---|---|---|
| Leverantörens API | Nyckel från kursen | `SUPPLIER_API_URL`, `SUPPLIER_API_KEY`, `SUPPLIER_BRANSCH` |
| Algolia | Gratiskonto på algolia.com | `ALGOLIA_APP_ID`, `ALGOLIA_ADMIN_KEY`, `ALGOLIA_SEARCH_KEY`, `ALGOLIA_INDEX_NAME` |
| Stripe | Testläge på stripe.com | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Supabase | Projekt med en publik bucket `product-images` | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_BUCKET` |
| PostNord | Customer plan på atdeveloper.postnord.com (sandlåda) | `POSTNORD_API_KEY`, `POSTNORD_API_URL`, `SHOP_POSTAL_CODE` |

Ett adminkonto skapas genom att registrera en användare och sätta `role = 'admin'` i tabellen `users`. Testkontot för rättning finns i inlämningskommentaren, inte i repot.

### 5. Testa integrationerna lokalt
- **Import:** logga in som admin → Admin: Produkter → *Importera CSV* / *Importera XML*. Importen synkar även sökindexet.
- **Sök:** första gången, klicka *Bygg om sökindex* för att skapa indexet och sorteringsreplikorna i Algolia.
- **Betalning:** starta webhook-lyssnaren i en egen terminal och kopiera `whsec_...` till `STRIPE_WEBHOOK_SECRET`:
  ```bash
  stripe listen --events checkout.session.completed,checkout.session.expired --forward-to localhost:3000/api/webhooks/stripe
  ```
  Betala med testkortet `4242 4242 4242 4242`, valfritt framtida datum och valfri CVC.
- **Utgången session:** `stripe post /v1/checkout/sessions/<cs_test_...>/expire`
- **Bilder:** Admin: Produkter → *Ladda upp* på en produkt (JPEG eller PNG, max 2 MB).
- **Frakt:** fyll i ett postnummer i kassan, till exempel `11152`.

## Arkitektur

React anropar bara den egna Express-servern. Varje extern tjänst har en adapter i `backend/integrations/` som är den enda koden som känner till tjänstens format:

| Adapter | Tjänst |
|---|---|
| `supplierAdapter.js` | Leverantörens CSV- och XML-export |
| `searchAdapter.js` | Algolia |
| `paymentAdapter.js` | Stripe |
| `storageAdapter.js` | Supabase Storage |
| `shippingAdapter.js` | PostNord |

Alla anrop har timeout, och fel från externa tjänster blir ett `ExternalServiceError` som felhanteraren i `server.js` gör om till ett mer begripligt meddelande. Svar från externa tjänster valideras med Zod innan de används.

## Reflektion

### 1. Integrationsmodeller
- **Leverantören – fil över REST.** Leverantören exporterar hela katalogen som CSV eller XML via en GET-förfrågan. Det passar en import som admin kör ibland: hela katalogen på en gång, i ett format som leverantörer redan använder. CSV-filen är i Windows-1252, så servern hämtar rådata och avkodar själv i stället för att anta UTF-8.
- **Algolia – SDK.** Algolias officiella paket sköter retries mot flera servrar och har inställbar timeout. Det kräver mindre egen kod än rå REST. Vi använder två nycklar: en som bara får söka och en som får skriva och bara används vid synk.
- **Stripe – redirect och webhook.** Kunden skickas till Stripes betalsida (redirect), så att kortuppgifter aldrig når vår server. Att ordern är betald får vi veta via en signerad webhook och inte via kundens återkomst. Kunden kan stänga fliken, och success-sidan kan öppnas av vem som helst.
- **Supabase Storage – SDK.** Uppladdning och borttagning sker med Supabases paket på servern, med den hemliga nyckeln. Bilderna visas sedan direkt från bucketens publika URL.
- **PostNord – REST.** Ombud och leveranstid hämtas med GET och JSON, eftersom det är det enda PostNord erbjuder och det passar enkla uppslag.

### 2. Varför via Express och inte direkt från React
Allt som körs i React går att läsa och ändra i webbläsaren. Algolias skrivnyckel, Stripes hemliga nyckel, Supabases service-nyckel och PostNords nyckel skulle synas för alla. Servern är också den enda som kan lita på priser: React skickar bara produkt-id, antal, fraktmetod och ombuds-id, och servern hämtar priser från databasen, räknar frakten och kontrollerar ombudet hos PostNord. Om någon ändrar priset i webbläsaren påverkar det inte vad Stripe debiterar. Till sist samlas timeout, felhantering och validering på ett ställe.

### 3. Integrera i stället för att bygga själv
- **Leverantören:** utan importen hade alla produkter behövt matas in för hand och hållas uppdaterade manuellt.
- **Algolia:** en egen sökmotor med stavfelstolerans, relevansordning och snabba filter kräver ett sökindex (till exempel Elasticsearch) som ska driftas, skalas och hållas i synk.
- **Stripe:** att ta emot kort själv kräver PCI DSS-certifiering, avtal med inlösare, 3D Secure och bedrägeriskydd. Det är orimligt för en liten shop.
- **Supabase Storage:** egen fillagring kräver disk som överlever omstarter (Render tömmer disken), backup, CDN och åtkomstkontroll.
- **PostNord:** ombudslistor och leveranstider bygger på PostNords egna data om depåer och rutter. Det går inte att bygga själv.

### 4. Om en tjänst är nere
- **Leverantören:** importen ger ett felmeddelande efter 10 sekunder och ingenting i databasen ändras.
- **Algolia:** produkter sparas ändå i databasen. Admin ser att sökindexet inte uppdaterades och kan klicka *Bygg om sökindex* senare. Sökningen visar ett vänligt fel.
- **Stripe:** ordern sparas som *Obetald* och kunden får "Betalningen är inte tillgänglig just nu". Kommer webhooken sent försöker Stripe igen, och bekräftelsesidan frågar servern i upp till 30 sekunder. En webhook som kommer flera gånger räknas bara en gång, eftersom statusen bara ändras om ordern fortfarande är obetald.
- **Supabase:** uppladdningen misslyckas med ett felmeddelande och produkten behåller sin gamla bild. Den gamla bilden tas bort först när den nya är sparad.
- **PostNord:** kassan visar fortfarande priser, och hemleverans går att välja. Saknas leveranstid står det "Leveranstid kunde inte hämtas". Ett ombudsköp stoppas med ett tydligt fel om ombudet inte kan kontrolleras.

### 5. Risker med beroendet
- **Kostnad och villkor:** shoppen körs på gratisnivåer. Railway stängde av min backend när provperioden tog slut, och jag fick flytta till Render och TiDB. Supabase pausar gratisprojekt efter en vecka utan aktivitet. Algolias gratiskvot kan ta slut om sökningen missbrukas, därför har sök-API:et ett tak på 50 träffar per sida.
- **Persondata (GDPR):** kundens namn, e-post och adress skickas till Stripe och sparas i databasen. PostNord får bara postnummer. Alla tjänster ska ha personuppgiftsbiträdesavtal, och datan bör ligga inom EU. Därför valde jag Frankfurt för TiDB, Render och Supabase.
- **Ändrade API:er:** PostNord har redan två versioner av leveranstids-API:et, och v1 är märkt *Legacy*. Eftersom bara adaptern känner till formatet räcker det att ändra en fil när det sker.

## Labb 1 – Mappning av leverantörens fält

| Leverantörens fält | Shoppens fält | Val |
|---|---|---|
| `artNr` | `products.sku` (UNIQUE) | Nyckel för upsert och `objectID` i Algolia |
| `ean` | `products.ean`, ny kolumn | **Lagt till.** Kostar en kolumn och sparas som text (`VARCHAR(13)`), så att den inledande nollan i `0735…` inte försvinner |
| `benamning` | `products.name` | |
| `kategori` | `categories` + `product_categories` | Tabellerna fanns redan, och kategorin behövs som filter i sökningen |
| `pris`, `lagersaldo` | `price`, `stock` | Decimalkomma görs om till punkt. Tomt lagersaldo blir 0 |
| `varianter` | Sparas inte | **Hoppat över.** Shoppens modell har ett pris och ett lagersaldo per produkt. Varianter hade krävt en ny tabell och ändringar i varukorg, order och lager. Fältet läses och valideras som lista, men sparas inte |
| `uppdaterad` | Sparas inte | Shoppen använder det inte |

Vid uppdatering skrivs bara fält som leverantören äger. `description` och `image_url` ägs av admin och lämnas orörda.

## Labb 5 – Så använde jag AI

**Prompter**
- "Jag har en Express- och React-shop för kläder med Stripe Checkout. Skriv en adapter i min Express-server som hämtar de närmaste PostNord-ombuden för ett postnummer och den beräknade leveranstiden, och lägg till fraktpris i kassan."
- "Varför ger leveranstidsanropet 502 Bad Gateway?"
- "Min backend är Express 5 med ES-moduler och mysql2. Externa anrop går via adaptrar i backend/integrations/ och använder fetchWithTimeout från utils/. Skriv en adapter shippingAdapter.js som hämtar de 5 närmaste PostNord-ombuden för ett svenskt postnummer och returnerar { id, name, address, city }."
- "Om PostNord inte svarar inom 5 sekunder ska ett ExternalServiceError kastas."
- "Anropet GET /rest/transport/v1/transittime/getTransitTimeInformation.json? Ger 502 Bad Gateway från openresty. Ombudsanropet med samma nyckel fungerar. Vad kan orsaken vara?"

**Vad AI:n föreslog**
- Ombud: `GET /rest/businesslocation/v5/servicepoints/nearest/byaddress` med `countryCode`, `postalCode` och `numberOfServicePoints`.
- Leveranstid: `GET /rest/transport/v1/transittime/getTransitTimeInformation.json` med `fromAddressPostalCode`, `toAddressPostalCode`, `serviceGroupCode` och ett valfritt `dateOfDeparture`.

**Vad som skilde sig från PostNords dokumentation**
- Ombud:Anropet mot sandlådan gav ombud med `servicePointId`, `name` och `visitingAddress`, precis som koden förväntade sig.
- Leveranstid: Anropet gav `502 Bad Gateway`. Enligt Swaggern för *Transit time calculation V1 and V2* (version 2.0.3) i PostNords portal är rätt anrop `GET /rest/transport/v2/transittime/addresstoaddress`. Parametrarna heter `originPostalCode` och `destinationPostalCode`, `startTime` är **obligatorisk**, `serviceGroupCode` finns inte, och svaret är en lista och inte ett objekt.
- Även dokumentationen avvek från verkligheten: i Swaggerns exempel heter tjänsterna "MyPack Home/Collect", medan sandlådan svarar "PostNord Home" och "PostNord Service Point".

**Hur jag löste det**
- Jag laddade ner Swaggern från portalen och ombad AI:n att skriva om adaptern efter den: v2-sökvägen, rätt parameternamn och `startTime` i svensk lokal tid.
- Jag verifierade med curl mot `atapi2.postnord.com` och fick HTTP 200 med `timeOfArrival` för tjänst 17 (hem) och 19 (ombud).
- Adaptern väljer tjänst på **kod** och inte på namn, och Zod-schemat följer Swaggerns svarsformat. 