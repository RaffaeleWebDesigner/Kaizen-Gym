import type { ReactNode } from 'react';
import { Card, Header } from '../components/ui';
import { MIN_AGE, PRIVACY_VERSION } from '../lib/privacy';

// BOZZA da far controllare a un professionista prima di aprire l'app al pubblico.
// I campi tra parentesi quadre vanno compilati da chi pubblica l'app.
const OWNER = '[Nome e cognome del titolare]';
const CONTACT = '[email di contatto per la privacy]';

function S({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-bold text-lg pt-2">{title}</h2>
      <div className="text-sm text-muted space-y-2 leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="pb-nav">
      <Header title="Privacy e termini" back />
      <div className="p-4"><PrivacyText /></div>
    </div>
  );
}

/** Testo di informativa e termini, usato anche dentro il benvenuto. */
export function PrivacyText() {
  return (
    <>
      <div className="space-y-3">
        <Card className="text-sm border-minima/50">
          Versione del {PRIVACY_VERSION.split('-').reverse().join('/')}. Kaizen-Gym è in prova (beta): questo testo può cambiare, e in quel caso te lo chiediamo di nuovo.
        </Card>

        <S title="Chi tratta i tuoi dati">
          <p>Titolare del trattamento: {OWNER}. Per qualsiasi richiesta sui tuoi dati scrivi a {CONTACT}.</p>
        </S>

        <S title="Cosa raccogliamo e perché">
          <p><b className="text-ink">Senza account</b> tutto resta solo sul tuo dispositivo: noi non riceviamo niente.</p>
          <p><b className="text-ink">Con l’account</b> salviamo una copia dei tuoi dati per sincronizzarli tra i tuoi dispositivi: email e password (cifrata), sedute, esercizi, modelli, sedute saltate e relativi motivi, obiettivi, sfide, successi, impostazioni e profilo di allenamento.</p>
          <p><b className="text-ink">Dati sulla salute.</b> Alcuni dati di allenamento possono dire qualcosa sulla tua salute (giorni di malattia, segnalazioni di dolore): quando crei l’account ti chiediamo il consenso esplicito per salvarli nel cloud. Peso e misure del corpo hanno un consenso a parte, facoltativo, che puoi togliere quando vuoi: senza, restano solo sul dispositivo. Le risposte alle domande sulla salute del primo avvio non vengono salvate.</p>
          <p><b className="text-ink">Foto dei progressi</b>: restano sempre e solo sul tuo dispositivo. Non le riceviamo mai.</p>
          <p>Base giuridica: esecuzione del servizio che chiedi (art. 6.1.b GDPR) e, per i dati sulla salute, il tuo consenso esplicito (art. 9.2.a GDPR).</p>
        </S>

        <S title="Dove stanno e per quanto">
          <p>I dati dell’account stanno su Supabase, nella regione Unione Europea (Francoforte), che agisce come responsabile del trattamento. Non vendiamo i dati, non li usiamo per pubblicità e non li condividiamo con altri.</p>
          <p>Li teniamo finché hai l’account. Se lo cancelli, i dati spariscono subito dal database; le copie di sicurezza cifrate vengono sovrascritte entro 60 giorni.</p>
        </S>

        <S title="I tuoi diritti">
          <p>Puoi in ogni momento: scaricare tutti i tuoi dati (Altro → Dati e backup), correggerli dall’app, cancellare l’account e tutti i dati (Altro → Account → Elimina account), togliere il consenso ai dati sulla salute, e scrivere a {CONTACT} per qualsiasi altra richiesta. Puoi anche presentare reclamo al Garante per la protezione dei dati personali (garanteprivacy.it).</p>
        </S>

        <S title="Età minima">
          <p>Per creare un account devi avere almeno {MIN_AGE} anni.</p>
        </S>

        <h1 className="text-xl font-bold pt-6">Termini d’uso</h1>

        <S title="Non è un consiglio medico">
          <p>Kaizen-Gym ti aiuta a organizzarti e a progredire con costanza, ma non sostituisce il parere di un medico, di un fisioterapista o di un allenatore. Prima di iniziare un’attività fisica, soprattutto se hai problemi di salute, parlane con il tuo medico.</p>
          <p>Se senti dolore fermati. I carichi e le progressioni proposti sono indicativi: sei tu a decidere cosa sollevare e come.</p>
        </S>

        <S title="Il servizio">
          <p>L’app è gratuita e in prova: può avere errori o interruzioni, e la sincronizzazione può non essere disponibile. Ti consigliamo di scaricare ogni tanto una copia dei tuoi dati.</p>
          <p>Nei limiti consentiti dalla legge, il titolare non risponde di infortuni o danni legati all’uso dell’app.</p>
        </S>
      </div>
    </>
  );
}
