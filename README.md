# Salvadanaio

**Versione 0.0**

Un programma per capire quanto di quello che guadagni riesci a mettere da parte.
Segni cosa entra e cosa esce; lui ti dice quanto è avanzato ogni mese, che
percentuale hai risparmiato e quanto ti manca per arrivare a un traguardo.

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

Ci sono tre viste.

**Mese.** In alto quattro numeri: quanto è entrato (diviso fra stipendio ed
extra), quanto è uscito, quanto è avanzato e che percentuale hai messo da parte.
Sotto, il modulo per segnare un movimento: scegli *Uscita* o *Entrata*, scrivi
l'importo, la categoria e, se vuoi, una descrizione. Con le frecce accanto al
nome del mese vedi i mesi passati.

Gli importi si possono scrivere come vuoi: `12,50`, `12.50`, `1.850`, `1850 €`.

Le categorie di partenza sono queste. Se nessuna ti va bene, scrivine una nuova:
dalla volta dopo te la propone lui.

- Entrate: Stipendio, Extra
- Uscite: Casa, Bollette, Spesa, Trasporti, Salute, Ristoranti e svago,
  Abbigliamento, Abbonamenti, Regali, Altro

Se il mese scorso hai segnato lo stipendio e questo mese non ancora, in cima
compare un avviso che propone di aggiungerlo uguale con un clic. Se è stato
diverso, premi *Era diverso*: il modulo si prepara e scrivi tu l'importo giusto.

**Andamento.** Un grafico con quanto è avanzato mese per mese: le colonne
verdi sono i mesi in positivo, quelle rosse i mesi in cui hai speso più di
quanto è entrato. Passando col mouse su una colonna leggi i dettagli. Sotto,
la tabella con tutti i mesi e la media.

**Obiettivo.** Due cose, tutte e due facoltative:

- *Una percentuale*, per esempio il 20%. Nella vista Mese vedi se l'hai
  raggiunta e, se no, quanti euro mancano.
- *Un traguardo*, per esempio 5.000 € per gli imprevisti entro dicembre. Ti
  dice a che punto sei, quanto serve al mese per arrivarci in tempo e, al
  ritmo degli ultimi tre mesi, in che mese ci arrivi davvero.

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
      public/conti.js        i calcoli: riepiloghi, medie, obiettivo
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
non entri nella media e che i conti dell'obiettivo siano giusti anche a cavallo
dell'anno.

## Cosa manca ancora (i prossimi passi)

1. Importare l'estratto conto della banca (file CSV), invece di scrivere tutto a mano
2. Spese fisse che si ripetono ogni mese (affitto, abbonamenti), come già succede per lo stipendio
3. Un budget per categoria: "per la spesa non più di 400 € al mese"
4. Esportare i dati per il commercialista o per un foglio di calcolo
