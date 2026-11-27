// Testi brevi e diretti, scritti per questa app.

export const DAILY_LINES = [
  'Non serve una grande seduta. Serve la seduta di oggi.',
  'Presentati. Il resto si sistema.',
  'Piccolo passo, tutti i giorni previsti. È così che si cresce.',
  'Il giorno no conta uguale: fai la minima e segnala.',
  'Due ripetizioni di margine. Torni anche la prossima volta.',
  'La costanza batte l’intensità, ogni settimana.',
  'Una seduta in più nel barattolo vale più di un record.',
  'Non devi avere voglia. Devi solo iniziare.',
  'Dieci minuti fatti battono un’ora rimandata.',
  'Oggi niente eroismi: solo il prossimo mattone.',
  'Hai già fatto la parte difficile: sei qui.',
  'Più uno. Basta così.',
];

export const SKIP_LINES = [
  'Scrivilo com’è. Niente punizioni, niente recuperi forzati.',
  'Guardare il motivo in faccia serve a riconoscerlo la prossima volta.',
  'Una seduta saltata non cancella quelle fatte. Si riparte dalla prossima.',
];

export const DONE_LINES = [
  'Fatta. Un’altra nel barattolo.',
  'Seduta in banca. Ci vediamo alla prossima.',
  'Ti sei presentato. È questo che conta.',
  'Un mattone in più. Il muro cresce così.',
];

export const MINIMA_LINE = 'Giorno no? 10-15 minuti e conta come seduta fatta.';

export const JAR_LINE = 'Ogni seduta qui dentro l’hai fatta tu. Guardale quando cala la voglia.';

export function pick(list: string[], seed = new Date().getDate()): string {
  return list[seed % list.length];
}
