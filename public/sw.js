/* Salvadanaio - il "service worker".
   Tiene una copia dei file della pagina, cosi' sull'iPhone si apre anche
   senza rete (in metro, in aereo). I DATI non passano di qui: stanno nella
   memoria del telefono (vedi memoria.js).

   Regola: prima la rete, poi la copia. Se c'e' connessione arriva sempre
   la versione piu' nuova; se non c'e', si usa l'ultima vista. */

const CASSETTO = 'salvadanaio-pagina';
const FILE = [
  './', 'index.html', 'stile.css', 'conti.js', 'archivio.js', 'memoria.js', 'app.js',
  'manifest.webmanifest', 'icone/icona-180.png', 'icone/icona-192.png',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(CASSETTO).then((c) => c.addAll(FILE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (evento) => {
  const richiesta = evento.request;
  if (richiesta.method !== 'GET' || new URL(richiesta.url).origin !== location.origin) return;
  evento.respondWith((async () => {
    const cassetto = await caches.open(CASSETTO);
    try {
      const risposta = await fetch(richiesta);
      if (risposta.ok) cassetto.put(richiesta, risposta.clone());
      return risposta;
    } catch (e) {
      const copia = await cassetto.match(richiesta, { ignoreSearch: true });
      if (copia) return copia;
      if (richiesta.mode === 'navigate') return cassetto.match('index.html');
      throw e;
    }
  })());
});
