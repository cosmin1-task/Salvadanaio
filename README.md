# Salvadanaio

**Versione 0.3**

Un programma per capire quanto di quello che guadagni riesci a mettere da parte.
Segni cosa entra e cosa esce; lui ti dice quanto è avanzato ogni mese, che
percentuale hai risparmiato e quanto ti manca per arrivare a un traguardo.
Se spendi più di una soglia che scegli tu, ti avvisa. Stipendio, affitto e
abbonamenti li scrivi una volta sola: ogni mese entrano da soli.

Funziona in due modi, con lo stesso programma:

- **sull'iPhone**, come app sulla schermata Home, con i dati nel telefono;
- **sul computer** (macOS, Windows, Linux), con i dati in un file della cartella.

In tutti e due i casi: niente account, niente banca collegata, nessun dato che
esce dal dispositivo.

## Sull'iPhone

1. Apri **Safari** (deve essere Safari) all'indirizzo
   **https://cosmin1-task.github.io/Salvadanaio/** (ti porta da solo alla
   pagina dell'app, che finisce in `/public/`)
2. Tocca il bottone **Condividi** (il quadrato con la freccia in su), poi
   **Aggiungi alla schermata Home**, poi **Aggiungi**.
3. Da ora aprilo dall'icona sulla Home: si apre a tutto schermo, come un'app,
   e funziona anche senza rete.

Fallo prima di inserire dati: quello che scrivi nella pagina aperta in Safari
resta in Safari, e l'app sulla Home ha una memoria tutta sua.

**Dove stanno i dati.** Nella memoria del telefono, dentro l'app. Non vanno su
internet e non passano da GitHub: l'indirizzo scarica solo il programma, vuoto.
Proprio per questo, se cancelli l'icona dalla Home o cambi telefono, i dati se
ne vanno con lei.

**La copia di sicurezza.** In **Opzioni → Copia di sicurezza** premi *Salva una
copia*: si apre il foglio di condivisione, scegli **Salva su File** e poi
**iCloud Drive**. Il file si chiama `salvadanaio-AAAA-MM-GG.json`. Per ripartire
da una copia (telefono nuovo, app reinstallata) premi *Carica una copia* e
scegli il file. Se non ne fai una da più di un mese, l'app te lo ricorda in
Giorno per giorno.

**Portare i dati dal Mac all'iPhone.** Il file della copia ha la stessa forma di
`dati.json`. Sul Mac, in Impostazioni, premi *Salva una copia* (oppure prendi
direttamente `dati.json` dalla cartella), mandalo all'iPhone con AirDrop o
iCloud Drive e caricalo dall'app. Da quel momento tieni i conti sull'iPhone:
i due non si sincronizzano.

**Gli aggiornamenti** arrivano da soli: quando c'è una versione nuova su
GitHub, alla prossima apertura con la rete l'app la prende. I dati restano.

Sul telefono le schede sono nella barra in basso: *Giorni*, *Mese*, *Grafico*,
*Fisse*, *Avvisi*, *Opzioni*. Sul grafico del mese tocca un punto o scorri il
dito di lato per leggere i numeri di ogni giorno.

## Sul computer

### Come si avvia

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

Sotto la riga di sintesi, *In arrivo* elenca le voci fisse che devono ancora
arrivare questo mese. I movimenti creati da una voce fissa portano l'etichetta
**fissa**: si correggono e si eliminano come gli altri, e la modifica vale solo
per quel mese.

(Se lo stipendio non è una voce fissa, quando arriva il giorno di paga compare
un avviso che propone di copiarlo dal mese scorso, oppure di renderlo fisso.)

**2. Mese.** La vista d'insieme: entrate (divise fra stipendio ed extra),
uscite, quanto è avanzato e che percentuale hai messo da parte. Poi il conto
*Quanto ti resta*: entrate fisse, meno spese fisse, meno le spese variabili
fatte finora. Sotto, a che punto sei con la soglia, dove sono andati i soldi divisi per categoria, cosa
è entrato, e il traguardo se ne hai scelto uno.

**3. Grafico.** In grande, la risposta alla domanda "questo mese sono in
positivo?". Sotto, un grafico con tre linee sui giorni del mese: le entrate
che si accumulano, le uscite che si accumulano e la soglia. Finché la linea
blu delle uscite resta sotto quella verde delle entrate, sei in positivo; il
giorno in cui passa la soglia è segnato con un cerchio. Passando col mouse
leggi i numeri di ogni giorno. Più in basso, tutti i mesi a confronto, con
grafico e tabella: un clic su una colonna porta a quel mese.

**Voci fisse.** Quello che torna uguale ogni mese: stipendio, affitto,
abbonamenti, bollette a importo fisso. Per ognuna scrivi importo, nome,
categoria e il giorno del mese. In cima, il conto di un mese tipo: quanto
entra, quanto esce di fisso e quanto resta per tutto il resto.

Come funzionano:

- **Nel loro giorno entrano da sole** fra i movimenti del mese. Se il
  Salvadanaio resta chiuso per un po', alla prossima apertura recupera quelle
  arrivate nel frattempo.
- **Prima del loro giorno sono "attese"**: non contano ancora come spese vere
  (e quindi nemmeno per la soglia), ma entrano nelle previsioni di fine mese.
- **Si parte da questo mese o dal prossimo**, a scelta. Se la voce l'avevi già
  segnata a mano questo mese (stesso importo, categoria e un nome simile), il
  programma la riconosce e non la raddoppia.
- **Cambiare una voce vale dai mesi successivi.** Se una bolletta un mese è
  diversa, correggi quel movimento in Giorno per giorno. Se un mese non l'hai
  pagata, elimina il movimento: non ricompare.
- **Togliere una voce** ferma i mesi futuri; quelli passati restano com'erano.
- Giorni 29, 30 e 31: nei mesi più corti vale l'ultimo giorno.

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
- **Le entrate attese contano.** L'affitto esce il primo, lo stipendio entra
  a fine mese: contando solo quello già entrato, ogni mese sarebbe "in rosso"
  per tre settimane. Quindi l'avviso rosso conta anche le entrate fisse non
  ancora arrivate (o, se lo stipendio non è una voce fissa, quello del mese
  scorso). La scritta grande nella scheda Grafico dice come chiuderà il mese
  contando tutte le voci fisse attese, entrate e spese.
- **La soglia conta tutte le uscite**, fisse comprese. Nella scheda Voci fisse
  vedi quanto della soglia se ne va in spese fisse e quanto ne resta per il resto.
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

Questi due file **non** finiscono nella cronologia di Git. Il repository su
GitHub è pubblico: chiunque può leggere il codice, nessuno può vedere i tuoi
dati, perché lì non ci sono mai stati.

Anche dal computer si può salvare una copia (Impostazioni → Copia di sicurezza),
ed è il modo per portare i dati sull'iPhone.

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
      server.js              sul computer: risponde al browser e scrive dati.json
      public/                la web app, la stessa sul computer e sull'iPhone
        index.html           la struttura della pagina
        stile.css            l'aspetto (sul telefono: barra in basso, campi grandi)
        app.js               il comportamento: cosa succede quando tocchi
        conti.js             i calcoli: riepiloghi, medie, soglia, avvisi, voci fisse
        archivio.js          le regole su come cambiano i dati (le usano
                             server.js sul computer e la pagina sull'iPhone)
        memoria.js           sull'iPhone: dove si salva l'archivio, nel telefono
        sw.js                sull'iPhone: tiene una copia della pagina per
                             aprirla senza rete
        manifest.webmanifest nome e icona per la schermata Home
        icone/               le icone
      index.html, .nojekyll  per GitHub Pages: l'indirizzo principale porta a public/
      prove/                 i controlli automatici
      dati.json              i tuoi dati
      Avvia Salvadanaio.command  il file da cliccare su Mac
      Avvia Salvadanaio.bat      il file da cliccare su Windows

Nessuna libreria esterna, nessun `npm install`. Sul computer serve solo
Node.js; sull'iPhone basta Safari.

Come fa la stessa pagina a sapere dove si trova: se arriva da `localhost` parla
con `server.js`; da qualunque altro indirizzo fa tutto da sola, con la memoria
del telefono. (Per provare il modo telefono sul computer: `http://localhost:4322/?telefono`.)

## Se qualcosa non va

- **"Manca Node.js"**: la finestra nera ti dice cosa scaricare. Da `nodejs.org`, versione LTS.
- **"La porta 4322 è già occupata"**: il Salvadanaio è già aperto da qualche parte.
  Vai su `http://localhost:4322`, oppure chiudi l'altra finestra nera.
- **La pagina dice che non riesce a contattare il programma**: hai chiuso la
  finestra nera. Riavvia col doppio clic.
- **Sull'iPhone non vedo i dati che ho inserito**: forse li hai inseriti nella
  pagina aperta in Safari e ora apri l'app dalla Home (o il contrario). Sono due
  memorie separate. Usa sempre l'icona sulla Home.

## Le prove

Nella cartella `prove/` ci sono i controlli automatici. Per eseguirli:

    node prove/conti.prova.js
    node prove/archivio.prova.js

(sul tuo Mac, dove Node sta nella cartella: `./.node-mac/bin/node prove/conti.prova.js`)

Falle girare prima di ogni push: quello che arriva su GitHub va online
sull'iPhone nel giro di un minuto.

Controllano che gli importi vengano letti bene in tutti i modi in cui si
scrivono, che i riepiloghi del mese tornino al centesimo, che il mese in corso
non entri nella media, che i conti dell'obiettivo siano giusti anche a cavallo
dell'anno, che gli avvisi scattino quando devono (una volta sola, e non per
uno stipendio che deve ancora arrivare) e che le voci fisse entrino nel giorno
giusto, senza doppioni e senza ricomparire dopo essere state tolte. Quelle
dell'archivio controllano che una copia di sicurezza sbagliata venga rifiutata
senza toccare niente, e che un `dati.json` delle versioni vecchie si carichi.

## Cosa manca ancora (i prossimi passi)

1. Importare l'estratto conto della banca (file CSV), invece di scrivere tutto a mano
2. Un budget per categoria: "per la spesa non più di 400 € al mese"
3. Voci fisse non mensili (l'assicurazione una volta l'anno, una bolletta ogni due mesi)
4. Esportare i dati per il commercialista o per un foglio di calcolo
