// Provo i calcoli con numeri costruiti a tavolino.
// Si esegue con:  node prove/conti.prova.js
const fs = require('fs'), vm = require('vm');
const ctx = {};
vm.createContext(ctx);
// Lo carico come lo carica il browser (senza "module"), cosi' provo la versione vera.
vm.runInContext(fs.readFileSync(__dirname + '/../public/conti.js', 'utf8')
  + '\nglobalThis.API = { leggiImporto, euro, riepilogoMese, andamento, mediaAvanzato,'
  + ' progressoObiettivo, meseDiArrivo, stipendioDaCopiare, spostaMese, nomeMese,'
  + ' entrateDiRiferimento, statoSoglia, controllaAvvisi, serieGiornaliera, giornoDiSuperamento };', ctx);
const C = ctx.API;

let errori = 0, prove = 0;
function uguale(ottenuto, atteso, cosa) {
  prove++;
  const ok = JSON.stringify(ottenuto) === JSON.stringify(atteso);
  if (!ok) errori++;
  console.log((ok ? '  ok  ' : ' NO!  ') + cosa + (ok ? '' : '\n        atteso:   ' + JSON.stringify(atteso)
    + '\n        ottenuto: ' + JSON.stringify(ottenuto)));
}

console.log('\nLettura degli importi');
uguale(C.leggiImporto('12,50'), 1250, '"12,50" -> 1250 centesimi');
uguale(C.leggiImporto('12.50'), 1250, '"12.50" col punto -> 1250');
uguale(C.leggiImporto('1.234,56'), 123456, '"1.234,56" all\'italiana');
uguale(C.leggiImporto('1.234'), 123400, '"1.234" sono milleduecento, non uno virgola due');
uguale(C.leggiImporto('1.850'), 185000, '"1.850" come stipendio');
uguale(C.leggiImporto('2.000.000'), 200000000, 'due milioni coi punti');
uguale(C.leggiImporto('1850'), 185000, 'numero senza separatori');
uguale(C.leggiImporto(' 45 € '), 4500, 'con spazi e simbolo dell\'euro');
uguale(C.leggiImporto('0,1'), 10, '"0,1" sono dieci centesimi');
uguale(C.leggiImporto('0,10') + C.leggiImporto('0,20'), 30, '0,10 + 0,20 fa esattamente 0,30');
uguale(C.leggiImporto('0'), null, 'zero non e\' un importo');
uguale(C.leggiImporto('-5'), null, 'i negativi non si scrivono: si sceglie "uscita"');
uguale(C.leggiImporto('12,345'), null, 'tre decimali: meglio chiedere');
uguale(C.leggiImporto('abc'), null, 'lettere');
uguale(C.leggiImporto(''), null, 'vuoto');

console.log('\nScrittura degli importi');
uguale(C.euro(123456), '1.234,56 €', '123456 -> "1.234,56 €"');
uguale(C.euro(-4500), '−45,00 €', 'negativo col segno meno');
uguale(C.euro(4500, true), '+45,00 €', 'con segno richiesto');
uguale(C.euro(0, true), '0,00 €', 'zero resta senza segno');

// Un piccolo archivio: luglio, agosto e settembre 2026.
const mov = [
  { tipo: 'entrata', importo: 185000, categoria: 'Stipendio', data: '2026-07-27' },
  { tipo: 'uscita',  importo: 70000,  categoria: 'Casa',      data: '2026-07-01' },
  { tipo: 'uscita',  importo: 30000,  categoria: 'Spesa',     data: '2026-07-15' },
  { tipo: 'entrata', importo: 185000, categoria: 'Stipendio', data: '2026-08-27' },
  { tipo: 'entrata', importo: 40000,  categoria: 'Extra',     data: '2026-08-10' },
  { tipo: 'uscita',  importo: 70000,  categoria: 'Casa',      data: '2026-08-01' },
  { tipo: 'uscita',  importo: 25000,  categoria: 'Spesa',     data: '2026-08-12' },
  { tipo: 'uscita',  importo: 15000,  categoria: 'Spesa',     data: '2026-08-20' },
  { tipo: 'uscita',  importo: 70000,  categoria: 'Casa',      data: '2026-09-01' },
];

console.log('\nRiepilogo di un mese');
const ago = C.riepilogoMese(mov, '2026-08');
uguale([ago.entrate, ago.stipendio, ago.extra], [225000, 185000, 40000], 'agosto: entrate 2.250 = stipendio 1.850 + extra 400');
uguale(ago.uscite, 110000, 'agosto: uscite 1.100');
uguale(ago.avanzato, 115000, 'agosto: avanzati 1.150');
uguale(Math.round(ago.percentuale * 10) / 10, 51.1, 'agosto: messo da parte il 51,1%');
uguale(ago.perCategoria.map((c) => c.categoria + ' ' + c.totale), ['Casa 70000', 'Spesa 40000'], 'le uscite si sommano per categoria, dalla piu\' grande');
const set = C.riepilogoMese(mov, '2026-09');
uguale(set.percentuale, null, 'settembre: niente entrate -> percentuale assente, non 0%');
uguale(set.avanzato, -70000, 'settembre: avanzato negativo');
const vuoto = C.riepilogoMese(mov, '2025-01');
uguale([vuoto.entrate, vuoto.uscite, vuoto.numeroMovimenti], [0, 0, 0], 'un mese senza movimenti e\' tutto a zero');

console.log('\nAndamento nel tempo');
const and = C.andamento(mov, '2026-11');
uguale(and.map((r) => r.mese), ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11'], 'dal primo movimento al mese indicato, compresi i mesi vuoti');
uguale(C.andamento([], '2026-09'), [], 'nessun movimento, nessun mese');
const salto = C.andamento([{ tipo: 'uscita', importo: 100, data: '2025-12-31' }], '2026-02');
uguale(salto.map((r) => r.mese), ['2025-12', '2026-01', '2026-02'], 'attraversa il cambio d\'anno');

console.log('\nMedia degli ultimi mesi');
uguale(C.mediaAvanzato(mov, '2026-09', 3), { media: 100000, mesi: 2 }, 'a settembre: media di luglio (850) e agosto (1.150), il mese in corso e\' escluso');
uguale(C.mediaAvanzato(mov, '2026-07', 3), null, 'a luglio non c\'e\' ancora nessun mese chiuso');
uguale(C.mediaAvanzato(mov, '2026-10', 1), { media: -70000, mesi: 1 }, 'con un mese solo: settembre, negativo');

console.log('\nObiettivo');
const ob = { importo: 500000, da: '2026-08-01', entro: '2026-12-31', partenza: 100000 };
const p = C.progressoObiettivo(mov, ob, '2026-09-25');
uguale(p.accumulato, 100000 + 115000 - 70000, 'partenza + agosto + settembre fino a oggi');
uguale(p.mancante, 500000 - 145000, 'quanto manca');
uguale(p.mesiRimasti, 4, 'da settembre a dicembre: 4 mesi, compreso questo');
uguale(p.servePerMese, Math.ceil(355000 / 4), 'quanto serve al mese, arrotondato per eccesso');
const futuro = mov.concat([{ tipo: 'entrata', importo: 999999, categoria: 'Extra', data: '2026-10-05' }]);
uguale(C.progressoObiettivo(futuro, ob, '2026-09-25').accumulato, 145000, 'un movimento con data futura non conta ancora');
uguale(C.progressoObiettivo(mov, { importo: 40000, da: '2026-08-01' }, '2026-09-25').raggiunto, true, 'superato il traguardo -> raggiunto');
uguale(C.progressoObiettivo(mov, { importo: 40000, da: '2026-08-01' }, '2026-09-25').quota, 1, 'la barra non va oltre il 100%');
uguale(C.progressoObiettivo(mov, { importo: 900000, da: '2026-08-01', entro: '2026-06-30' }, '2026-09-25').scaduto, true, 'data passata e cifra non raggiunta -> scaduto');
uguale(C.progressoObiettivo(mov, null, '2026-09-25'), null, 'nessun obiettivo');

console.log('\nIn che mese ci arrivi');
uguale(C.meseDiArrivo(300000, 100000, '2026-09'), '2026-11', '3.000 a 1.000 al mese: settembre, ottobre, novembre');
uguale(C.meseDiArrivo(300001, 100000, '2026-09'), '2026-12', 'un centesimo in piu\' vuol dire un mese in piu\'');
uguale(C.meseDiArrivo(300000, 0, '2026-09'), null, 'senza risparmio non ci arrivi');
uguale(C.meseDiArrivo(300000, -5000, '2026-09'), null, 'con risparmio negativo nemmeno');
uguale(C.meseDiArrivo(0, 0, '2026-09'), '2026-09', 'gia\' arrivato');

console.log('\nStipendio da copiare');
const proposta = C.stipendioDaCopiare(mov, '2026-09');
uguale([proposta.importo, proposta.data, proposta.categoria], [185000, '2026-09-27', 'Stipendio'], 'settembre: propone 1.850 il 27, come agosto');
uguale(C.stipendioDaCopiare(mov, '2026-08'), null, 'agosto ce l\'ha gia\': nessuna proposta');
uguale(C.stipendioDaCopiare(mov, '2026-07'), null, 'giugno non aveva stipendio: nessuna proposta');
const fineMese = [{ tipo: 'entrata', importo: 1000, categoria: 'Stipendio', data: '2026-01-31' }];
uguale(C.stipendioDaCopiare(fineMese, '2026-02').data, '2026-02-28', 'il 31 gennaio diventa il 28 febbraio');

console.log('\nSoglia');
const sog = C.statoSoglia(mov, '2026-08', 100000);
uguale([sog.speso, sog.restano, sog.superata], [110000, -10000, true], 'agosto: 1.100 spesi su 1.000 di soglia -> superata di 100');
uguale(C.statoSoglia(mov, '2026-08', 110000).superata, false, 'arrivare esattamente alla soglia non e\' superarla');
uguale(C.statoSoglia(mov, '2026-08', null), null, 'senza soglia, niente stato');

console.log('\nEntrate di riferimento');
uguale(C.entrateDiRiferimento(mov, '2026-09'), { entrate: 185000, gia: 0, stipendioAtteso: 185000 }, 'settembre: stipendio non arrivato, conta quello di agosto');
uguale(C.entrateDiRiferimento(mov, '2026-08').stipendioAtteso, 0, 'agosto: lo stipendio c\'e\', nessun atteso');

console.log('\nAvvisi');
const imp = { soglia: 60000 };
let av = C.controllaAvvisi(mov, imp, '2026-09', []);
uguale(av.map((a) => a.tipo), ['soglia'], 'settembre: 700 spesi, soglia 600 -> avviso soglia, ma non rosso (lo stipendio e\' atteso)');
uguale(C.controllaAvvisi(mov, imp, '2026-09', av).length, 0, 'lo stesso avviso non si ripete nello stesso mese');
uguale(C.controllaAvvisi(mov, { soglia: 80000 }, '2026-09', []).length, 0, 'sotto la soglia nessun avviso');
uguale(C.controllaAvvisi(mov, {}, '2026-09', []).length, 0, 'senza soglia e senza rosso, silenzio');
const spendaccione = mov.concat([{ tipo: 'uscita', importo: 120000, categoria: 'Altro', data: '2026-09-20' }]);
av = C.controllaAvvisi(spendaccione, { soglia: 160000 }, '2026-09', []);
uguale(av.map((a) => a.tipo), ['soglia', 'rosso'], 'settembre a 1.900 spesi: soglia 1.600 e rosso sui 1.850 attesi');
uguale(av[1].testo, 'Settembre 2026: le uscite (1.900,00 €) hanno superato le entrate previste (1.850,00 €, contando lo stipendio non ancora arrivato) di 50,00 €.', 'il testo dell\'avviso rosso');
uguale(C.controllaAvvisi(mov, {}, '2026-07', []).length, 0, 'luglio in positivo: nessun rosso');
const vecchio = [{ tipo: 'soglia', mese: '2026-08' }];
uguale(C.controllaAvvisi(spendaccione, { soglia: 160000 }, '2026-09', vecchio).length, 2, 'un avviso di agosto non conta per settembre');

console.log('\nSerie giorno per giorno');
const serie = C.serieGiornaliera(mov, '2026-08', '2026-09-25');
uguale(serie.length, 31, 'un mese chiuso ha tutti i suoi giorni');
uguale(serie[0], { giorno: 1, entrate: 0, uscite: 70000 }, 'il primo: affitto');
uguale(serie[11], { giorno: 12, entrate: 40000, uscite: 95000 }, 'il 12: extra del 10 e spesa del 12, accumulati');
uguale(serie[30], { giorno: 31, entrate: 225000, uscite: 110000 }, 'l\'ultimo giorno torna col riepilogo');
uguale(C.serieGiornaliera(mov, '2026-09', '2026-09-25').length, 25, 'il mese in corso si ferma a oggi');
uguale(C.serieGiornaliera(mov, '2026-10', '2026-09-25').length, 0, 'un mese futuro e\' vuoto');
const conBolletta = mov.concat([{ tipo: 'uscita', importo: 5000, categoria: 'Bollette', data: '2026-09-28' }]);
const sb = C.serieGiornaliera(conBolletta, '2026-09', '2026-09-25');
uguale([sb.length, sb[sb.length - 1].uscite], [28, 75000], 'una spesa gia\' segnata per il 28 allunga il mese in corso fino al 28');
uguale(C.giornoDiSuperamento(serie, 100000), 20, 'la soglia di 1.000 si supera il 20 agosto');
uguale(C.giornoDiSuperamento(serie, 500000), null, 'una soglia mai superata');

console.log('\nMesi');
uguale(C.spostaMese('2026-12', 1), '2027-01', 'dicembre + 1 = gennaio dell\'anno dopo');
uguale(C.spostaMese('2026-01', -1), '2025-12', 'gennaio - 1 = dicembre dell\'anno prima');
uguale(C.nomeMese('2026-09'), 'settembre 2026', 'nome del mese');

console.log('\n' + (errori ? errori + ' prove su ' + prove + ' NON passano.' : 'Tutte le ' + prove + ' prove passano.') + '\n');
process.exit(errori ? 1 : 0);
