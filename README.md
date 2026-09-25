# Salvadanaio

**Versione 0.1**

Un programma per capire quanto di quello che guadagni riesci a mettere da parte.
Segni cosa entra e cosa esce; lui ti dice quanto è avanzato ogni mese, che
percentuale hai risparmiato e quanto ti manca per arrivare a un traguardo.
Se spendi più di una soglia che scegli tu, ti avvisa.

Gira solo sul tuo computer: niente internet, niente account, niente banca
collegata. Nessun dato esce da qui. Funziona su macOS, Windows e Linux.

## Come si avvia

Su Mac: doppio clic su **`Avvia Salvadanaio.command`**.
Su Windows: doppio clic su **`Avvia Salvadanaio.bat`**.

Si apre una finestra del Terminale (quella nera) e subito dopo il browser
all'indirizzo `http://localhost:4322`.

**La finestra nera deve restare aperta** mentre usi il Salvadanaio: è il
programma vero e proprio. Se la chiudi, il Salvadanaio si spegne.

Il Taccuino usa la porta 4321 e il Salvadanaio la 4322, quindi puoi tenerli
aperti tutti e due insieme.

> La prima volta macOS potrebbe dire che il file "non può essere aperto perché
> proviene da uno sviluppatore non identificato". In quel caso: clic destro sul
> file, poi **Apri**, poi **Apri** di nuovo nella finestra che compare.
> Succede una volta sola.

## Come si usa

È pensato per essere aperto mese per mese: in cima alle prime tre schede c'è
il nome del mese, con le frecce per andare avanti e indietro.

**1. Giorno per giorno.** Qui si segnano le spese: scegli *Uscita* o
*Entrata*, scrivi l'importo, la causale (per esempio "spesa Esselunga") e la
categoria. Sotto, l'elenco del mese diviso per giorni, con il totale speso in
ogni giorno. Una riga in alto riassume: quanto hai speso oggi, quanto nel mese
e quanto manca alla soglia.

Gli importi si possono scrivere come vuoi: `12,50`, `12.50`, `1.850`, `1850 €`.

Le categorie di partenza sono queste. Se nessuna ti va bene, scrivine una nuova:
dalla volta dopo te la propone lui.

- Entrate: Stipendio, Extra
- Uscite: Casa, Bollette, Spesa, Trasporti, Salute, Ristoranti e svago,
  Abbigliamento, Abbonamenti, Regali, Altro

Quando arriva il giorno di paga e lo stipendio non è ancora segnato, in cima
compare un avviso che propone di aggiungerlo uguale al mese scorso con un clic.
Se è stato diverso, premi *Era diverso* e scrivi tu l'importo giusto.

**2. Mese.** La vista d'insieme: entrate (divise fra stipendio ed extra),
uscite, quanto è avanzato e che percentuale hai messo da parte. Sotto, a che
punto sei con la soglia, dove sono andati i soldi divisi per categoria, cosa
è entrato, e il traguardo se ne hai scelto uno.

**3. Grafico.** In grande, la risposta alla domanda "questo mese sono in
positivo?". Sotto, un grafico con tre linee sui giorni del mese: le entrate
che si accumulano, le uscite che si accumulano e la soglia. Finché la linea
blu delle uscite resta sotto quella verde delle entrate, sei in positivo; il
giorno in cui passa la soglia è segnato con un cerchio. Passando col mouse
leggi i numeri di ogni giorno. Più in basso, tutti i mesi a confronto, con
grafico e tabella: un clic su una colonna porta a quel mese.

**Notifiche.** Lo storico degli avvisi (vedi sotto). Il numero accanto al
nome della scheda dice quanti non hai ancora letto.

**Impostazioni.** La soglia di sicurezza, la percentuale da mettere da parte
ogni mese e il traguardo in euro (per esempio 5.000 € per gli imprevisti entro
dicembre: ti dice quanto serve al mese e, al ritmo attuale, in che mese ci arrivi).

## La soglia di sicurezza e gli avvisi

Nelle Impostazioni scegli una cifra, per esempio 1.600 € se ne guadagni 1.800.
Vale per tutti i mesi finché non la cambi.

Finché le uscite del mese restano sotto quella cifra, il Salvadanaio sta zitto.
Appena la superi, in cima alla pagina compare un avviso arancione che resta
lì finché non premi *Ho capito*, e che ritrovi nella scheda Notifiche.

C'è un secondo avviso, rosso: quando le uscite del mese superano le entrate,
cioè quando il mese va in rosso.

Tre cose da sapere:

- **Ogni avviso arriva una volta sola per mese.** Se superi la soglia a metà
  mese, le spese dopo non ne generano altri.
- **Lo stipendio atteso conta.** L'affitto esce il primo, lo stipendio entra
  a fine mese: contando solo quello già entrato, ogni mese sarebbe "in rosso"
  per tre settimane. Quindi, finché lo stipendio del mese non è segnato, il
  programma conta quello del mese scorso come atteso. Lo stesso vale per la
  scritta grande nella scheda Grafico.
- **Gli avvisi sono sullo schermo, non nel Centro Notifiche del Mac.** Le soglie
  si superano quando segni una spesa, e in quel momento hai la pagina davanti.

## Cosa intende per "messo da parte"

Il Salvadanaio non conosce il tuo conto in banca. Per lui **messo da parte
vuol dire non speso**: entrate del mese meno uscite del mese.

Quindi i numeri sono giusti quanto è completo quello che segni. Una spesa
dimenticata diventa, per lui, un risparmio. Il consiglio è segnare le uscite
subito, anche piccole, e una volta al mese dare un'occhiata all'estratto conto
per recuperare quelle perse.

Due scelte che vale la pena sapere:

- **Il mese in corso non è ancora un mese.** A metà mese lo stipendio è già
  entrato ma le spese non sono ancora tutte uscite, e il numero sembra più
  bello di quello che sarà. Per questo nella vista Mese c'è scritto "per ora",
  e la media usata per le previsioni conta solo i mesi chiusi.
- **Un mese senza entrate non ha percentuale.** Scrive "—" invece di 0%,
  perché 0% vorrebbe dire "è entrato qualcosa e non hai risparmiato nulla",
  che è un'altra cosa.

## Dove finiscono i dati

Nel file **`dati.json`**, in questa stessa cartella. È un file di testo: puoi
aprirlo, leggerlo, copiarlo altrove per fare un backup.

Ad ogni salvataggio viene tenuta una copia della versione precedente in
`dati.backup.json`. Se qualcosa va storto, quella copia è la tua rete di sicurezza.

Questi due file **non** finiscono nella cronologia di Git, e il repository su
GitHub è privato. Il codice è su GitHub; i tuoi soldi no.

Gli importi sono salvati in centesimi (12,50 € diventa `1250`). Se apri
`dati.json` e vedi numeri cento volte più grandi del previsto, è per questo:
i computer sbagliano di poco i conti con la virgola, e sui soldi quel poco si vede.

## Portarlo su un altro computer

Come per il Taccuino: il modo pulito è GitHub Desktop, scegliendo il repository
Salvadanaio. Se invece copi la cartella, lascia fuori `.node-mac` e `node-win`,
che valgono solo per il sistema su cui sono stati messi.

Su Windows serve Node.js: dalla versione LTS su `nodejs.org`, installata oppure
estratta dal pacchetto .zip in una cartella `node-win` qui dentro.

**I dati non si sincronizzano.** Ogni computer ha il suo `dati.json`: sono due
salvadanai separati con lo stesso nome. Per i soldi è un limite più scomodo che
per il Taccuino, perché i conti tornano solo se ogni spesa sta in un posto solo.
Il consiglio, per ora, è usarlo da un computer solo.

## Com'è fatto dentro

    Salvadanaio/
      server.js              il programma: risponde al browser e salva su disco
      public/index.html      la struttura della pagina
      public/stile.css       l'aspetto
      public/app.js          il comportamento: cosa succede quando clicchi
      public/conti.js        i calcoli: riepiloghi, medie, obiettivo, soglia, avvisi
                             (li usano sia la pagina sia server.js)
      prove/                 i controlli automatici
      dati.json              i tuoi dati
      Avvia Salvadanaio.command  il file da cliccare su Mac
      Avvia Salvadanaio.bat      il file da cliccare su Windows

Nessuna libreria esterna, nessun `npm install`. Serve solo Node.js.

## Se qualcosa non va

- **"Manca Node.js"**: la finestra nera ti dice cosa scaricare. Da `nodejs.org`, versione LTS.
- **"La porta 4322 è già occupata"**: il Salvadanaio è già aperto da qualche parte.
  Vai su `http://localhost:4322`, oppure chiudi l'altra finestra nera.
- **La pagina dice che non riesce a contattare il programma**: hai chiuso la
  finestra nera. Riavvia col doppio clic.

## Le prove

Nella cartella `prove/` ci sono i controlli automatici. Per eseguirli:

    node prove/conti.prova.js

(sul tuo Mac, dove Node sta nella cartella: `./.node-mac/bin/node prove/conti.prova.js`)

Controllano che gli importi vengano letti bene in tutti i modi in cui si
scrivono, che i riepiloghi del mese tornino al centesimo, che il mese in corso
non entri nella media, che i conti dell'obiettivo siano giusti anche a cavallo
dell'anno, e che gli avvisi scattino quando devono: una volta sola, e non per
uno stipendio che deve ancora arrivare.

## Cosa manca ancora (i prossimi passi)

1. Importare l'estratto conto della banca (file CSV), invece di scrivere tutto a mano
2. Spese fisse che si ripetono ogni mese (affitto, abbonamenti), come già succede per lo stipendio
3. Un budget per categoria: "per la spesa non più di 400 € al mese"
4. Esportare i dati per il commercialista o per un foglio di calcolo
