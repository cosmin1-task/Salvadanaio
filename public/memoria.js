/* Salvadanaio - la memoria del telefono.
   Quando il Salvadanaio gira da solo sull'iPhone non c'e' nessun server e
   nessun dati.json: l'archivio sta nella memoria del browser (IndexedDB),
   dentro il telefono, e non esce da li'.

   Si tengono due copie, come sul Mac: l'archivio e la versione precedente,
   per poter tornare indietro se un salvataggio va storto. */

const Memoria = (function () {
  const NOME = 'salvadanaio';
  const DEPOSITO = 'archivio';

  function apri() {
    return new Promise((risolvi, rifiuta) => {
      const richiesta = indexedDB.open(NOME, 1);
      richiesta.onupgradeneeded = () => richiesta.result.createObjectStore(DEPOSITO);
      richiesta.onsuccess = () => risolvi(richiesta.result);
      richiesta.onerror = () => rifiuta(richiesta.error);
    });
  }

  async function operazione(modo, fai) {
    const db = await apri();
    try {
      return await new Promise((risolvi, rifiuta) => {
        const tx = db.transaction(DEPOSITO, modo);
        const esito = fai(tx.objectStore(DEPOSITO));
        tx.oncomplete = () => risolvi(esito && esito.result);
        tx.onerror = () => rifiuta(tx.error);
        tx.onabort = () => rifiuta(tx.error || new Error('Salvataggio interrotto'));
      });
    } finally {
      db.close();
    }
  }

  // L'archivio salvato, o null se sul telefono non c'e' ancora niente.
  async function carica() {
    const testo = await operazione('readonly', (s) => s.get('dati'));
    return testo ? JSON.parse(testo) : null;
  }

  // Salva l'archivio; quello di prima diventa la copia "precedente".
  // Le due scritture stanno nella stessa transazione: o tutte e due o nessuna.
  async function salva(dati) {
    const nuovo = JSON.stringify(dati);
    const vecchio = await operazione('readonly', (s) => s.get('dati'));
    await operazione('readwrite', (s) => {
      if (vecchio) s.put(vecchio, 'precedente');
      s.put(nuovo, 'dati');
    });
  }

  /* Chiede al telefono di non cancellare mai questi dati per fare spazio.
     Sull'iPhone le app aggiunte alla Home lo sono gia'; chiederlo non costa. */
  async function rendiPersistente() {
    try {
      if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
    } catch (e) { /* non tutti i browser lo sanno fare */ }
    return false;
  }

  return { carica, salva, rendiPersistente };
})();
