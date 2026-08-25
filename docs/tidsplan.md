# Tidsplan

**Deadline:** tisdag 260825


| Dag | Fokus | Status | Faktiskt utfall |
|---|---|---|---|
| Måndag | Projektstart: repo skapat, planering | Klart | Enligt plan |
| Tisdag | Backend grundstruktur: Express, dotenv, cors, nodemon | Klart | Enligt plan |
| Onsdag | MySQL installerat och konfigurerat, databas skapad, backend kopplad via mysql2 | Klart | Enligt plan |
| Torsdag | ER-diagram och sitemap färdigställda | Klart | Enligt plan |
| Fredag | Tidsplan färdig, databastabeller skapade, backend-API för produkter | Klart | Enligt plan |
| Lördag | React-grundstruktur, produktlista, produktsida | Klart | Enligt plan |
| Söndag | Varukorg, kassa/checkout, order i databasen, admin: produkter och ordrar | Klart | Enligt plan |
| Måndag | Inloggning (kund och admin), buffert för ofärdiga G-krav | Klart | Deploy tog betydligt längre tid än väntat (flera databasleverantörer krånglade: Aiven svarade aldrig på DNS-uppslag, PandaStack erbjöd bara PostgreSQL). Löstes genom att byta till Railway. Inloggning (VG) byggdes klart samma dag som planerat |
| Tisdag | Orderstatus, responsivitet, deploy, README, kravmatris, inlämning | Delvis | VG-kravet "varukorg i databasen" prioriterades bort medvetet med cirka 2 timmar kvar till deadline, för att säkra att redan fungerande G- och VG-funktioner inte riskerades av otestad kod under tidspress. Fokus flyttades i stället till att stärka README och dokumentation som visar förståelse för databaskommunikation, systemarkitektur och kravanpassad design |

**Reflektion:** Den största avvikelsen mot planen var tidsåtgången för deploy (måndagen), där tre olika databasvärdar (Aiven, PandaStack, Railway) behövde testas innan en fungerande lösning hittades. Databasen skrevs tillfälligt om till PostgreSQL som en reservlösning, men återställdes till MySQL när Railway visade sig fungera. Detta åt upp tid som annars var avsatt för det sista VG-kravet. Prioritetsordningen som sattes upp i förväg (säkra G, sedan deploy, sedan VG i fallande viktighetsordning) följdes genomgående, vilket gjorde det möjligt att fatta ett medvetet, tidspressat beslut sist i projektet utan att riskera redan uppnådda krav.