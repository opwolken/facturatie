# Infra en Deploy Overzicht

Dit document zet de infra, technische keuzes en deployflow van dit project compact op een rij.
Het doel is tweeledig:

- begrijpen waarom dit project relatief snel en eenvoudig deployt;
- dezelfde opzet als referentie kunnen gebruiken in een ander project.

## 1. Samenvatting

De snelheid en eenvoud komen hier vooral uit deze combinatie:

- frontend is een statische SPA met React + Vite;
- deploytarget voor de frontend is Firebase Hosting, dus geen eigen server of SSR-runtime;
- backend-functionaliteit zit in losse Firebase Cloud Functions en hoeft niet mee te deployen bij elke frontend-wijziging;
- data en assets zitten volledig in Firebase-diensten: Firestore, Storage, Auth;
- caching is bewust zo ingesteld dat nieuwe deploys snel zichtbaar zijn;
- build pipeline is klein: alleen Vite build naar `dist/`.

Kort gezegd: de app bestaat uit een snelle statische frontend plus een paar losse serverless functies. Dat is veel lichter dan een architectuur met SSR, Docker, eigen API-server, database-migraties of meerdere gekoppelde deploystappen.

## 2. Architectuur in een oogopslag

### Frontend

- React 19
- Vite 6
- React Router 7
- Tailwind CSS 3
- Hosting op Firebase Hosting

De frontend wordt lokaal gebouwd naar `dist/` en daarna als statische site uitgerold.

Belangrijke config:

- [package.json](/Users/daan/Projecten/ontwerp-app/package.json)
- [vite.config.js](/Users/daan/Projecten/ontwerp-app/vite.config.js)
- [firebase.json](/Users/daan/Projecten/ontwerp-app/firebase.json)

### Backend / server-side logica

Er zijn twee serverless lagen:

1. Node.js Firebase Functions in `functions/`
2. Python Firebase Function codebase in `functions/scrape_product/`

Deze functies doen alleen het werk dat niet in de browser hoort:

- Funda-import met Gemini-analyse
- AI image generatie
- productafbeeldingen downloaden en opslaan in Storage
- product scraping via Python

Belangrijke config en entrypoints:

- [functions/index.js](/Users/daan/Projecten/ontwerp-app/functions/index.js)
- [functions/package.json](/Users/daan/Projecten/ontwerp-app/functions/package.json)
- [functions/scrape_product/main.py](/Users/daan/Projecten/ontwerp-app/functions/scrape_product/main.py)

### Data en platformdiensten

- Firebase Auth voor login
- Firestore voor appdata
- Firebase Storage voor uploads en gegenereerde assets
- Firebase Hosting voor de webapp

Frontend-initialisatie:

- [src/services/firebase.js](/Users/daan/Projecten/ontwerp-app/src/services/firebase.js)

### PWA / caching

De app heeft een service worker, maar die is expliciet minder agressief gemaakt om snelle iteratie mogelijk te houden.

- network-first strategie voor veel requests
- `index.html`, `manifest.json` en `service-worker.js` staan op no-cache headers
- optionele cache bypass via `?nocache=1`

Belangrijke bestanden:

- [public/service-worker.js](/Users/daan/Projecten/ontwerp-app/public/service-worker.js)
- [firebase.json](/Users/daan/Projecten/ontwerp-app/firebase.json)

## 3. Waarom deze setup snel deployt

### 3.1 Statische frontend in plaats van SSR

De grootste winst zit hier.

Dit project gebruikt Vite om een statische build te maken. Firebase Hosting serveert daarna alleen bestanden uit `dist/`.

Dat betekent:

- geen server-rendering tijdens requests;
- geen Node webserver die mee moet deployen voor de frontend;
- geen container build voor de frontend;
- geen aparte backend release nodig voor gewone UI-aanpassingen.

Bij veel tragere projecten zit de vertraging juist in een van deze zaken:

- Next.js SSR of ISR;
- Cloud Run of App Engine als webserver;
- Docker build + push;
- monorepo deploy waarbij frontend, backend en workers tegelijk worden uitgerold.

### 3.2 Hosting en functions zijn logisch gescheiden

De frontend staat op Firebase Hosting, terwijl serverlogica in functions zit. Daardoor kun je gericht deployen:

- alleen frontend: `firebase deploy --only hosting`
- alleen functions: `firebase deploy --only functions`
- alles: `firebase deploy`

Dat is een belangrijk verschil met projecten waar alles aan elkaar vastzit in een enkele release.

### 3.3 Kleine buildstap

De frontend-build is minimaal:

```bash
npm run build
```

Die draait alleen:

```json
"build": "vite build"
```

Dus geen extra asset-pipelines, geen SSR-compile, geen server-bundles, geen codegenstap, geen native packaging.

### 3.4 Firebase Hosting is een goede match voor dit type app

Deze app is een client-side SPA met router-rewrite naar `index.html`.

In [firebase.json](/Users/daan/Projecten/ontwerp-app/firebase.json) staat:

- `public: "dist"`
- rewrite van `**` naar `/index.html`

Dat is precies het simpele pad voor React Router in de browser.

### 3.5 Cache-instellingen zijn op iteratie ingericht

Bij veel PWA-projecten voelt deploy langzaam terwijl de deploy technisch al klaar is. De browser laat dan nog oude assets zien.

Hier is dat deels ondervangen met:

- `no-store, no-cache, must-revalidate` voor `index.html`
- dezelfde aanpak voor service worker en manifest
- network-first in de service worker
- handmatige bypass via `?nocache=1`

Daardoor voelt een deploy niet alleen snel in CI/CD-termen, maar ook snel in wat je als gebruiker direct ziet.

## 4. Concrete infra-keuzes

### 4.1 Frontend stack

Keuze:

- React + Vite + React Router

Waarom praktisch:

- Vite geeft snelle lokale feedback;
- build-output is statisch en dus eenvoudig te hosten;
- weinig infrastructuur nodig;
- goed schaalbaar voor een app die vooral in de browser werkt.

Trade-off:

- minder geschikt als je echt SSR, SEO op paginaniveau of edge-rendering nodig hebt.

### 4.2 Firebase als volledig app-platform

Keuze:

- Auth, Firestore, Storage, Hosting en Functions allemaal binnen Firebase

Waarom praktisch:

- weinig platform-frictie;
- weinig losse credentials en netwerkconfiguratie;
- eenvoudige lokale en productie-setup;
- frontend en backend integreren direct met dezelfde omgeving.

Trade-off:

- sterkere vendor lock-in;
- backendpatronen worden vanzelf meer Firebase-specifiek.

### 4.3 Serverless functies in plaats van vaste backendserver

Keuze:

- losse callable/HTTP functies voor specifieke taken

Waarom praktisch:

- je deployed alleen backendcode die nodig is;
- geen always-on server voor sporadische taken;
- goede match voor AI-calls, scraping en imports.

Trade-off:

- cold starts kunnen voelbaar zijn;
- complexe backend-workflows worden lastiger dan in een traditionele API-server.

### 4.4 Meerdere function codebases

Keuze:

- Node codebase voor app-functies
- Python codebase voor scraping

Waarom praktisch:

- Python scraper hoeft niet in Node geperst te worden;
- elke codebase kan runtime-specifiek blijven;
- duidelijk scheiding tussen applogica en scraperlogica.

Trade-off:

- function deploys zijn zwaarder dan pure hosting deploys;
- Python functies voelen vaak trager bij build/deploy dan statische hosting.

### 4.5 Regio en resource-limieten expliciet instellen

In dit project is dat niet volledig impliciet gelaten.

Voorbeelden:

- Node functions gebruiken `region: "europe-west1"`
- Python scraper gebruikt ook `region="europe-west1"`
- Firestore staat in `europe-west4`
- `maxInstances` is begrensd om kosten en piekgedrag te beheersen

Waarom praktisch:

- voorspelbaarder gedrag;
- lagere kans op onnodige kostenpieken;
- beter controleerbare performance.

Trade-off:

- regio-keuzes moet je bewust afstemmen op gebruikers, data en andere services.

## 5. Deployflow van dit project

### 5.1 Frontend-only deploy

Dit is de snelste en meest voorkomende flow voor gewone UI-wijzigingen.

```bash
npm run build
firebase deploy --only hosting
```

Wat er gebeurt:

1. Vite bouwt de app naar `dist/`
2. Firebase Hosting uploadt de statische output
3. alle routes blijven werken via rewrite naar `index.html`
4. browser krijgt nieuwe shell sneller te zien door de no-cache headers

### 5.2 Function-only deploy

Voor wijzigingen in backendlogica:

```bash
firebase deploy --only functions
```

Let op:

- dit is trager dan alleen hosting;
- Python codebase maakt deploy meestal nog wat zwaarder;
- functions kunnen secrets, runtime en dependency-installaties meenemen.

### 5.3 Full deploy

Als hosting, functions, rules of indexen tegelijk mee moeten:

```bash
firebase deploy
```

Deze route is simpel, maar niet altijd de snelste. Voor iteratief werken is gericht deployen meestal beter.

## 6. Welke bestanden bepalen de infra

Gebruik dit als checklist als je dezelfde opzet wilt kopieren.

### Frontend

- [package.json](/Users/daan/Projecten/ontwerp-app/package.json)
- [vite.config.js](/Users/daan/Projecten/ontwerp-app/vite.config.js)
- [src/services/firebase.js](/Users/daan/Projecten/ontwerp-app/src/services/firebase.js)

### Firebase platformconfig

- [firebase.json](/Users/daan/Projecten/ontwerp-app/firebase.json)
- [firestore.rules](/Users/daan/Projecten/ontwerp-app/firestore.rules)
- [firestore.indexes.json](/Users/daan/Projecten/ontwerp-app/firestore.indexes.json)
- [storage.rules](/Users/daan/Projecten/ontwerp-app/storage.rules)

### Functions

- [functions/package.json](/Users/daan/Projecten/ontwerp-app/functions/package.json)
- [functions/index.js](/Users/daan/Projecten/ontwerp-app/functions/index.js)
- [functions/generateImage.js](/Users/daan/Projecten/ontwerp-app/functions/generateImage.js)
- [functions/fundaImport.js](/Users/daan/Projecten/ontwerp-app/functions/fundaImport.js)
- [functions/downloadProductImages.js](/Users/daan/Projecten/ontwerp-app/functions/downloadProductImages.js)
- [functions/scrape_product/main.py](/Users/daan/Projecten/ontwerp-app/functions/scrape_product/main.py)

### PWA / cachegedrag

- [public/service-worker.js](/Users/daan/Projecten/ontwerp-app/public/service-worker.js)

## 7. Waarom een ander project met "dezelfde infra" toch trager kan zijn

Zelfs als twee projecten allebei Firebase gebruiken, kunnen ze heel anders aanvoelen.

Vaak zit het verschil in een of meer van deze punten:

- het andere project deployt altijd hosting en functions samen;
- het andere project gebruikt zwaardere functions of meer dependencies;
- het andere project heeft SSR of een eigen servercomponent;
- build-output is veel groter;
- PWA caching of browser caching maskeert nieuwe releases;
- er lopen extra stappen mee zoals tests, lint, codegen of image-optimalisatie;
- er worden veel meer functies of meerdere codebases gedeployed;
- deploy target is Cloud Run of een containerplatform in plaats van pure Hosting.

Dus: "zelfde infra" op hoog niveau betekent nog niet "zelfde releasepad".

## 8. Herbruikbare blauwdruk voor een ander project

Als je deze aanpak wilt kopieren, houd dan dit minimum aan:

1. Gebruik een statische frontend-build, bij voorkeur Vite.
2. Host die build direct op Firebase Hosting.
3. Houd backendlogica los in Functions en deploy die alleen wanneer nodig.
4. Gebruik Firebase-diensten end-to-end als dat bij het product past.
5. Stel caching zo in dat `index.html` niet blijft hangen.
6. Maak gerichte deploycommando's onderdeel van je workflow.

Een goede standaardset is:

```bash
npm run build
firebase deploy --only hosting
firebase deploy --only functions
```

## 9. Wanneer deze aanpak minder geschikt is

Deze architectuur is niet automatisch de beste keuze als je project vooral leunt op:

- SSR of SEO als kernvereiste;
- zware backend-orchestratie;
- langdurige jobs of queue-gebaseerde verwerking;
- veel private server-to-server integraties;
- complexe relationele datamodellen en transacties buiten Firestore's model.

In dat soort gevallen kan een andere architectuur logischer zijn, ook als deploys dan trager worden.

## 10. Praktische conclusie

Dit project deployed snel omdat het frontend-releasepad klein is:

- build statische assets;
- upload naar Hosting;
- minimale cache-frictie;
- backend alleen deployen wanneer nodig.

Als je andere project trager is, moet je waarschijnlijk niet alleen naar "Firebase ja/nee" kijken, maar naar deze vragen:

1. Is de frontend daar echt statisch, of zit er server-runtime achter?
2. Deploy je alleen hosting, of altijd ook functions/containers mee?
3. Zit de traagheid in deploytijd, buildtijd of cache-zichtbaarheid?
4. Is de caching-strategie daar agressiever?
5. Zijn de backend codebases of dependencies daar groter?

Als je wilt, kan ik hierna ook een tweede versie maken die meer als template is geschreven voor je andere project, met invulblokken zoals `Hosting`, `Database`, `Functions`, `CI/CD`, `Secrets`, `Deploy commando's` en `Trade-offs`.