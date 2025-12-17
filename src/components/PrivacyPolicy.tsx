import React from 'react';
import { X, Shield, Eye, Database, UserX, FileText } from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';

interface PrivacyPolicyProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ isOpen, onClose }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Informativa Privacy">
      <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-4">

        {/* Introduzione */}
        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
            <Shield className="w-5 h-5 mr-2 text-green-600" />
            Informativa sul Trattamento dei Dati Personali
          </h3>
          <p className="text-gray-700 text-sm leading-relaxed">
            Ai sensi degli artt. 13 e 14 del Regolamento UE 2016/679 (GDPR), La informiamo che i Suoi dati
            personali saranno trattati con le modalità e per le finalità seguenti.
          </p>
        </section>

        {/* Titolare del Trattamento */}
        <section>
          <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
            <FileText className="w-4 h-4 mr-2 text-blue-600" />
            1. Titolare del Trattamento
          </h4>
          <p className="text-gray-700 text-sm">
            <strong>Titolare del Trattamento:</strong> Abruzzo.AI<br />
            <strong>Fornitore del Servizio:</strong> Poltrona - Sistema di Gestione Appuntamenti<br />
            <strong>Sede:</strong> Italia<br />
            <strong>Email:</strong> info@abruzzo.ai<br />
            <strong>Sito web:</strong> www.abruzzo.ai
          </p>
          <p className="text-gray-700 text-sm mt-2">
            <strong>Nota:</strong> Per quanto riguarda i dati personali dei clienti dei singoli negozi registrati 
            sulla piattaforma, il titolare del trattamento è il negozio stesso, che utilizza Poltrona come 
            strumento di gestione. Abruzzo.AI agisce come responsabile del trattamento per conto dei negozi.
          </p>
        </section>

        {/* Finalità del Trattamento */}
        <section>
          <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
            <Database className="w-4 h-4 mr-2 text-purple-600" />
            2. Finalità del Trattamento
          </h4>
          <p className="text-gray-700 text-sm leading-relaxed">
            I Suoi dati personali saranno trattati esclusivamente per le seguenti finalità:
          </p>
          <ul className="list-disc list-inside text-gray-700 text-sm space-y-1 mt-2">
            <li><strong>Gestione delle prenotazioni:</strong> organizzazione e gestione degli appuntamenti presso il negozio</li>
            <li><strong>Erogazione dei servizi:</strong> fornitura dei servizi richiesti (taglio capelli, barba, ecc.)</li>
            <li><strong>Comunicazioni operative:</strong> invio di conferme, promemoria e comunicazioni relative agli appuntamenti via email e/o SMS</li>
            <li><strong>Gestione account:</strong> creazione e gestione dell'account utente sulla piattaforma</li>
            <li><strong>Adempimenti legali:</strong> adempimento degli obblighi contrattuali, fiscali e di legge</li>
            <li><strong>Miglioramento del servizio:</strong> analisi statistica anonima per il miglioramento della piattaforma</li>
          </ul>
          <p className="text-gray-700 text-sm mt-3 font-medium">
            I Suoi dati NON saranno utilizzati per finalità di marketing diretto, profilazione comportamentale 
            o comunicati a terzi per scopi commerciali senza il Suo esplicito consenso.
          </p>
        </section>

        {/* Base Giuridica */}
        <section>
          <h4 className="font-semibold text-gray-900 mb-2">3. Base Giuridica</h4>
          <p className="text-gray-700 text-sm">
            Il trattamento è basato su:
          </p>
          <ul className="list-disc list-inside text-gray-700 text-sm space-y-1 mt-2">
            <li><strong>Consenso dell'interessato</strong> (art. 6, par. 1, lett. a) GDPR</li>
            <li><strong>Esecuzione del contratto</strong> (art. 6, par. 1, lett. b) GDPR per la gestione delle prenotazioni</li>
            <li><strong>Adempimento obblighi legali</strong> (art. 6, par. 1, lett. c) GDPR per obblighi fiscali</li>
          </ul>
        </section>

        {/* Dati Raccolti */}
        <section>
          <h4 className="font-semibold text-gray-900 mb-2">4. Categorie di Dati Personali</h4>
          <p className="text-gray-700 text-sm">
            Raccogliamo i seguenti dati personali:
          </p>
          <ul className="list-disc list-inside text-gray-700 text-sm space-y-1 mt-2">
            <li><strong>Dati anagrafici:</strong> nome, cognome</li>
            <li><strong>Dati di contatto:</strong> indirizzo email, numero di telefono (formato E.164)</li>
            <li><strong>Dati di accesso:</strong> password (criptata con algoritmi sicuri)</li>
            <li><strong>Dati relativi alle prenotazioni:</strong> data, ora, servizi richiesti, barbiere assegnato</li>
            <li><strong>Dati di navigazione:</strong> indirizzo IP, tipo di browser, pagine visitate (in forma anonima)</li>
            <li><strong>Dati opzionali:</strong> note preferenze, indirizzo (se fornito)</li>
          </ul>
          <p className="text-gray-700 text-sm mt-2">
            Non raccogliamo dati particolari (ex sensibili) quali dati sanitari, religiosi o politici, 
            salvo che non siano strettamente necessari per l'erogazione del servizio.
          </p>
        </section>

        {/* Conservazione */}
        <section>
          <h4 className="font-semibold text-gray-900 mb-2">5. Periodo di Conservazione</h4>
          <p className="text-gray-700 text-sm leading-relaxed">
            I Suoi dati personali saranno conservati per il tempo strettamente necessario al perseguimento
            delle finalità sopra indicate:
          </p>
          <ul className="list-disc list-inside text-gray-700 text-sm space-y-1 mt-2">
            <li><strong>Dati account:</strong> fino alla richiesta di cancellazione del Suo account o fino a 3 anni di inattività</li>
            <li><strong>Dati prenotazioni:</strong> fino a 2 anni dalla data dell'ultimo appuntamento</li>
            <li><strong>Dati fiscali:</strong> per il periodo previsto dalla legge italiana (10 anni) se applicabile</li>
            <li><strong>Dati di navigazione:</strong> fino a 12 mesi dalla raccolta</li>
          </ul>
          <p className="text-gray-700 text-sm mt-2">
            Trascorso il periodo di conservazione, i dati saranno cancellati o anonimizzati in modo irreversibile.
          </p>
        </section>

        {/* Diritti dell'Interessato */}
        <section>
          <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
            <Eye className="w-4 h-4 mr-2 text-orange-600" />
            6. I Suoi Diritti
          </h4>
          <p className="text-gray-700 text-sm leading-relaxed">
            In qualità di interessato, ha il diritto di:
          </p>
          <ul className="list-disc list-inside text-gray-700 text-sm space-y-1 mt-2">
            <li><strong>Accesso:</strong> ottenere conferma che sia in corso un trattamento di dati personali che La riguardano</li>
            <li><strong>Rettifica:</strong> ottenere la rettifica dei dati personali inesatti che La riguardano</li>
            <li><strong>Cancellazione:</strong> ottenere la cancellazione dei dati personali che La riguardano (diritto all'oblio)</li>
            <li><strong>Limitazione:</strong> ottenere la limitazione del trattamento</li>
            <li><strong>Portabilità:</strong> ricevere in un formato strutturato i dati personali che La riguardano</li>
            <li><strong>Opposizione:</strong> opporsi al trattamento dei dati personali che La riguardano</li>
            <li><strong>Revoca del consenso:</strong> revocare il consenso in qualsiasi momento</li>
          </ul>
          <p className="text-gray-700 text-sm mt-3">
            Per esercitare i Suoi diritti, può contattarci all'indirizzo email: [EMAIL PRIVACY]
          </p>
        </section>

        {/* Comunicazione e Trasferimento */}
        <section>
          <h4 className="font-semibold text-gray-900 mb-2">7. Comunicazione dei Dati</h4>
          <p className="text-gray-700 text-sm leading-relaxed">
            I Suoi dati personali possono essere comunicati a:
          </p>
          <ul className="list-disc list-inside text-gray-700 text-sm space-y-1 mt-2">
            <li><strong>Personale autorizzato del negozio:</strong> per la gestione degli appuntamenti</li>
            <li><strong>Fornitori di servizi tecnici:</strong> hosting, email, SMS (solo se necessario e con garanzie adeguate)</li>
            <li><strong>Autorità competenti:</strong> su richiesta delle autorità giudiziarie o amministrative nei casi previsti dalla legge</li>
          </ul>
          <p className="text-gray-700 text-sm mt-2">
            I dati sono trattati principalmente all'interno dell'Unione Europea. Qualora alcuni servizi 
            tecnici utilizzino server ubicati al di fuori dell'UE, verranno adottate garanzie appropriate 
            ai sensi del GDPR (Standard Contractual Clauses o altri strumenti legali riconosciuti).
          </p>
          <p className="text-gray-700 text-sm mt-2 font-medium">
            I Suoi dati NON saranno venduti, affittati o comunicati a terzi per finalità di marketing 
            senza il Suo esplicito consenso.
          </p>
        </section>

        {/* Sicurezza */}
        <section>
          <h4 className="font-semibold text-gray-900 mb-2">8. Misure di Sicurezza</h4>
          <p className="text-gray-700 text-sm leading-relaxed">
            Il Titolare adotta misure di sicurezza tecniche e organizzative adeguate per proteggere i dati
            personali, incluse ma non limitate a:
          </p>
          <ul className="list-disc list-inside text-gray-700 text-sm space-y-1 mt-2">
            <li>Crittografia dei dati in transito (HTTPS/TLS) e a riposo</li>
            <li>Autenticazione sicura con password complesse e hash crittografici</li>
            <li>Controlli di accesso basati su ruoli e permessi</li>
            <li>Backup regolari e procedure di disaster recovery</li>
            <li>Monitoraggio continuo per rilevare accessi non autorizzati</li>
            <li>Formazione del personale autorizzato sulla protezione dei dati</li>
          </ul>
          <p className="text-gray-700 text-sm mt-2">
            Nonostante le misure adottate, nessun sistema è completamente sicuro. Si prega di utilizzare 
            password complesse e di non condividere le credenziali di accesso.
          </p>
        </section>

        {/* Reclamo */}
        <section>
          <h4 className="font-semibold text-gray-900 mb-2">9. Diritto di Reclamo</h4>
          <p className="text-gray-700 text-sm">
            Lei ha il diritto di proporre reclamo all'Autorità Garante per la Protezione dei Dati Personali
            (www.garanteprivacy.it) qualora ritenga che il trattamento dei Suoi dati violi il GDPR.
          </p>
        </section>

        {/* Aggiornamenti */}
        <section>
          <h4 className="font-semibold text-gray-900 mb-2">10. Aggiornamenti</h4>
          <p className="text-gray-700 text-sm">
            Questa informativa può essere aggiornata periodicamente. La versione aggiornata sarà sempre
            disponibile sul nostro sistema.
          </p>
          <p className="text-gray-700 text-sm mt-2">
            <strong>Versione:</strong> 2.0<br />
            <strong>Data:</strong> Dicembre 2025<br />
            <strong>Conforme a:</strong> Regolamento UE 2016/679 (GDPR), D.Lgs. 196/2003 come modificato dal D.Lgs. 101/2018
          </p>
        </section>

        {/* Footer Note */}
        <div className="bg-gray-50 rounded-lg p-4 mt-6">
          <p className="text-gray-600 text-xs text-center">
            Prendendo visione della presente informativa e procedendo con la registrazione,
            Lei presta il Suo consenso al trattamento dei dati personali secondo le modalità
            e per le finalità sopra descritte.
          </p>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={onClose} variant="primary">
          Ho capito
        </Button>
      </div>
    </Modal>
  );
};





