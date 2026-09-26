// Provo l'archivio: le regole su come cambiano i dati, uguali sul Mac e sull'iPhone.
// Si esegue con:  node prove/archivio.prova.js
const Archivio = require('../public/archivio.js');

let errori = 0, prove = 0;
function uguale(ottenuto, atteso, cosa) {
  prove++;
  const ok = JSON.stringify(ottenuto) === JSON.stringify(atteso);
  if (!ok) errori++;
  console.log((ok ? '  ok  ' : ' NO!  ') + cosa + (ok ? '' : '\n        atteso:   ' + JSON.stringify(atteso)
    + '\n        ottenuto: ' + JSON.stringify(ottenuto)));
}

const OGGI = '2026-09-25';
const chiedi = (dati, metodo, percorso, corpo) => Archivio.rispondi(dati, metodo, percorso, corpo, OGGI);

console.log('\nArchivio vuoto');
let d = Archivio.vuoto();
let r = chiedi(d, 'GET', '/api/dati');
uguale([r.codice, r.modificato, r.corpo.movimenti.length], [200, false, 0], 'aprire un archivio vuoto non lo modifica');

console.log('\nMovimenti');
r = chiedi(d, 'POST', '/api/movimenti', { tipo: 'uscita', importo: 1250, categoria: 'Spesa', descrizione: 'Pane', data: '2026-09-20' });
uguale([r.codice, r.modificato, d.movimenti.length], [201, true, 1], 'una spesa valida entra');
const id = r.corpo.movimento.id;
r = chiedi(d, 'POST', '/api/movimenti', { tipo: 'uscita', importo: -5 });
uguale([r.codice, r.corpo.errore, r.modificato, d.movimenti.length], [400, 'Importo non valido', false, 1], 'un importo negativo viene rifiutato e non tocca niente');
r = chiedi(d, 'PUT', '/api/movimenti/' + id, { importo: 1500 });
uguale([r.codice, d.movimenti[0].importo, d.movimenti[0].descrizione], [200, 1500, 'Pane'], 'la modifica cambia solo quello che le dai');
r = chiedi(d, 'PUT', '/api/movimenti/' + id, { fissaId: 'finto' });
uguale(d.movimenti[0].fissaId, '', 'il legame con una voce fissa non si falsifica dalla pagina');
r = chiedi(d, 'DELETE', '/api/movimenti/inesistente');
uguale(r.codice, 404, 'eliminare qualcosa che non c\'e\' risponde "non trovato"');
r = chiedi(d, 'GET', '/api/sconosciuto');
uguale(r.codice, 404, 'un indirizzo sconosciuto risponde "non trovato"');

console.log('\nVoci fisse');
d = Archivio.vuoto();
chiedi(d, 'POST', '/api/movimenti', { tipo: 'uscita', importo: 70000, categoria: 'Casa', descrizione: 'Affitto', data: '2026-09-01' });
r = chiedi(d, 'POST', '/api/fisse', { tipo: 'uscita', nome: 'Affitto', importo: 70000, categoria: 'Casa', giorno: 1, da: '2026-09' });
uguale([r.codice, !!r.corpo.collegato, d.movimenti.length], [200, true, 1], 'l\'affitto gia\' segnato a mano viene adottato, non raddoppiato');
r = chiedi(d, 'POST', '/api/fisse', { tipo: 'uscita', nome: 'Palestra', importo: 4000, categoria: 'Salute', giorno: 5, da: '2026-09' });
uguale(d.movimenti.filter((m) => m.descrizione === 'Palestra').map((m) => m.data), ['2026-09-05'], 'una voce col giorno gia\' passato entra subito');
r = chiedi(d, 'POST', '/api/fisse', { tipo: 'entrata', nome: 'Stipendio', importo: 185000, categoria: 'Stipendio', giorno: 27, da: '2026-09' });
uguale(d.movimenti.filter((m) => m.descrizione === 'Stipendio').length, 0, 'lo stipendio del 27 non entra il 25');
r = Archivio.rispondi(d, 'GET', '/api/dati', null, '2026-09-27');
uguale([r.modificato, d.movimenti.filter((m) => m.descrizione === 'Stipendio').length], [true, 1], 'il 27, aprendo la pagina, lo stipendio entra da solo');
r = Archivio.rispondi(d, 'GET', '/api/dati', null, '2026-09-27');
uguale([r.modificato, d.movimenti.length], [false, 3], 'riaprire la pagina non crea doppioni');
r = chiedi(d, 'POST', '/api/fisse', { tipo: 'uscita', nome: '', importo: 100, giorno: 3 });
uguale(r.codice, 400, 'una voce senza nome viene rifiutata');

console.log('\nAvvisi');
d = Archivio.vuoto();
chiedi(d, 'POST', '/api/movimenti', { tipo: 'entrata', importo: 5000, categoria: 'Extra', data: '2026-09-02' });
chiedi(d, 'PUT', '/api/impostazioni', { soglia: 10000 });
r = chiedi(d, 'POST', '/api/movimenti', { tipo: 'uscita', importo: 12000, categoria: 'Altro', data: '2026-09-20' });
uguale(r.corpo.nuoveNotifiche.map((n) => n.tipo), ['soglia', 'rosso'], 'superare la soglia e le entrate fa scattare i due avvisi');
r = chiedi(d, 'POST', '/api/notifiche/lette', {});
uguale(d.notifiche.every((n) => n.letta), true, 'segna tutte come lette');

console.log('\nCopia di sicurezza');
d = Archivio.vuoto();
r = chiedi(d, 'POST', '/api/copia-fatta');
uguale([r.modificato, typeof d.impostazioni.ultimaCopia], [true, 'string'], 'si ricorda quando e\' stata fatta l\'ultima copia');

console.log('\nImportare');
// Un archivio in formato 0.0: niente soglia, niente notifiche, niente voci fisse.
const vecchio = {
  movimenti: [
    { id: 'a1', tipo: 'entrata', importo: 185000, categoria: 'Stipendio', descrizione: '', data: '2026-08-27', creato: '2026-08-27T10:00:00.000Z' },
    { id: 'a2', tipo: 'uscita', importo: 70000, categoria: 'Casa', descrizione: 'Affitto', data: '2026-09-01', creato: '2026-09-01T10:00:00.000Z' },
  ],
  impostazioni: { percentualeObiettivo: 20, obiettivo: null },
};
d = Archivio.vuoto();
chiedi(d, 'POST', '/api/movimenti', { tipo: 'uscita', importo: 999, categoria: 'Altro', data: '2026-09-10' });
r = chiedi(d, 'POST', '/api/importa', { dati: vecchio });
uguale([r.codice, d.movimenti.map((m) => m.id), d.impostazioni.percentualeObiettivo, d.impostazioni.soglia, d.fisse.length],
  [200, ['a1', 'a2'], 20, null, 0], 'un archivio della 0.0 si importa e sostituisce quello di prima');
uguale(d.movimenti[1].creato, '2026-09-01T10:00:00.000Z', 'le date originali restano');
const primaDiSbagliare = JSON.stringify(d);
r = chiedi(d, 'POST', '/api/importa', { dati: { movimenti: [{ tipo: 'uscita', importo: 'tanti' }] } });
uguale([r.codice, JSON.stringify(d) === primaDiSbagliare], [400, true], 'un file con un movimento sbagliato viene rifiutato e non tocca niente');
uguale(r.corpo.errore, 'Il movimento n. 1 non e\' valido: Importo non valido', 'e l\'errore dice quale');
r = chiedi(d, 'POST', '/api/importa', { dati: [1, 2, 3] });
uguale(r.codice, 400, 'una cosa che non e\' un archivio viene rifiutata');

console.log('\nArchivi delle versioni vecchie');
const s = Archivio.sistema({ movimenti: [], impostazioni: { soglia: 5 } });
uguale([s.impostazioni.soglia, s.impostazioni.ultimaCopia, s.fisse, s.notifiche], [5, null, [], []], 'si completano senza perdere niente');

console.log('\n' + (errori ? errori + ' prove su ' + prove + ' NON passano.' : 'Tutte le ' + prove + ' prove passano.') + '\n');
process.exit(errori ? 1 : 0);
