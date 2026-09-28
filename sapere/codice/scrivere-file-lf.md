---
titolo: Scrivere file del repo da script — il fine riga LF e le sequenze di escape
tipo: codice
tool: []
data: 2026-09-17
---

I file del repo sono salvati con fine riga **LF**, `core.autocrlf` è `false` e **non c'è
`.gitattributes`**: git salva esattamente i byte che trova sul disco.

Riscrivere un file esistente con uno script Python (`io.open(p, 'w')`) su Windows lo converte in
**CRLF**, e allora git vede *tutto il file* come cambiato: una riga modificata in `package.json`
diventava un diff da 29 righe, e 90 righe aggiunte a `test/smoke.mjs` ne diventavano 4.834.

**Perché:** in modalità testo Python traduce l'a capo in `os.linesep`, che su Windows è CR+LF. Lo
stesso vale per ogni strumento di scrittura che non conserva il fine riga originale.

**Come si applica:** scrivere con `newline=''` esplicito (e leggere con lo stesso), oppure fare
modifiche mirate invece di riscrivere tutto il file. Prima di committare, confrontare
`git diff --cached --ignore-cr-at-eol --stat` con `git diff --cached --stat`: se i due numeri non
coincidono è successo questo, e si rimedia con `sed -i 's/\r$//'` sui file toccati.

## La seconda trappola, e morde in silenzio: le sequenze di escape

In una stringa Python non-raw il backslash viene interpretato *mentre si scrive il file*: `\b` diventa
un backspace (0x08) e `\n` un a capo vero, e finiscono nel codice generato come caratteri di controllo.
È costato due volte in una sessione: una regex `\bprocess\s*\.` scritta in un test è arrivata sul disco
col backspace al posto di `\b`, non ha mai trovato niente e **il lucchetto sembrava verde mentre non
guardava nulla**; e un `join` con l'a capo dentro un template literal ha spezzato un file `.ts` a metà
stringa. Il segnale di Python è un `SyntaxWarning: invalid escape sequence` su `\s` o `\d`: se compare,
controllare anche i `\b` e i `\n` della stessa stringa, che *non* danno avviso proprio perché sono
sequenze valide.

Vale anche per il **testo in prosa** e per `node -e '...'` con template literal: il 2026-09-17 un README
ha perso i backslash di `.venv\Scripts\activate` (scritto `.venvScriptsactivate`) ed è finito in un
commit. E in bash i backtick dentro una stringa fra doppi apici vengono eseguiti come comandi.

**Come si applica:** per scrivere codice usare stringhe **raw** (`r"..."`); per un a capo dentro un
template literal JS scrivere `String.fromCharCode(10)`. Poi **verificare il file scritto, non lo
script**: rileggere la riga e passarla a `cat -A`, dove i caratteri di controllo si vedono (`^H`). E un
test nuovo va sempre provato **rompendo apposta** la cosa che sorveglia.
