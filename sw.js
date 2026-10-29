// Wird von tools/build_pages.py erzeugt – nicht von Hand ändern.
// Seiten: erst Netz, sonst gespeicherte Fassung. Bilder, CSS, JS: sofort aus dem Speicher, im Hintergrund erneuern.
const STAND = 'neusser-53d02dcf0f';
const VORAB = [
  "./",
  "index.html",
  "speisekarte.html",
  "kasse.html",
  "ueber-uns.html",
  "impressum.html",
  "datenschutz.html",
  "manifest.webmanifest",
  "assets/css/style.css?v=6654c457",
  "assets/js/kasse.js?v=12df79af",
  "assets/js/main.js?v=72c9b1db",
  "assets/js/menu.js?v=64526bd2",
  "assets/js/nav.js?v=633944f5",
  "assets/js/offers-data.js?v=680287e9",
  "assets/js/shop-daten.js?v=a57072a7",
  "assets/js/warenkorb.js?v=77414a38",
  "assets/img/logo.webp",
  "assets/img/muster-imbiss.svg",
  "assets/img/dishes/doener-teller.webp",
  "assets/img/dishes/doener.webp",
  "assets/img/dishes/lahmacun.webp",
  "assets/img/dishes/pizza.webp",
  "assets/img/icons/app-180.png",
  "assets/img/icons/app-192.png",
  "assets/img/icons/app-48.png",
  "assets/img/icons/app-512.png",
  "assets/img/icons/app-maskable-512.png",
  "assets/img/icons/cola.webp",
  "assets/img/icons/flamme.webp",
  "assets/img/icons/pizza.webp",
  "assets/img/icons/rabatt-12.webp",
  "assets/img/kategorien/burger.webp",
  "assets/img/kategorien/doener-drehspiess.webp",
  "assets/img/kategorien/doener-ueberbacken.webp",
  "assets/img/kategorien/falafel.webp",
  "assets/img/kategorien/fuer-kids.webp",
  "assets/img/kategorien/getraenke.webp",
  "assets/img/kategorien/imbiss-saucen.webp",
  "assets/img/kategorien/lahmacun.webp",
  "assets/img/kategorien/pasta.webp",
  "assets/img/kategorien/pide.webp",
  "assets/img/kategorien/pizza.webp",
  "assets/img/kategorien/salate.webp",
  "assets/img/kategorien/schnitzel.webp",
  "assets/img/kategorien/spar-menues.webp",
  "assets/img/logo/basis.webp",
  "assets/img/logo/flammen.webp",
  "assets/img/logo/pizza.webp",
  "assets/img/logo/spiess-dreh.webp",
  "assets/img/logo/spiess.webp"
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(STAND).then((c) => c.addAll(VORAB)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== STAND).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/bestellsystem/') || url.pathname.includes('/api/')) return;

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => {
      const kopie = res.clone();
      caches.open(STAND).then((c) => c.put(req, kopie));
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('speisekarte.html'))));
    return;
  }

  e.respondWith(caches.match(req).then((alt) => {
    const neu = fetch(req).then((res) => {
      if (res.ok) { const kopie = res.clone(); caches.open(STAND).then((c) => c.put(req, kopie)); }
      return res;
    }).catch(() => alt);
    return alt || neu;
  }));
});
