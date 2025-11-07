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
        {/* Nota per l'implementatore */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800 text-sm font-medium">
            Questa è una struttura placeholder. I documenti legali definitivi devono essere forniti
            dal titolare del trattamento o da un legale specializzato in privacy.
          </p>
        </div>

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
            <strong>Titolare:</strong> [NOME BARBERSHOP]<br />
            <strong>Sede:</strong> [INDIRIZZO COMPLETO]<br />
            <strong>P.IVA:</strong> [PARTITA IVA]<br />
            <strong>Email:</strong> [EMAIL CONTATTO]<br />
            <strong>PEC:</strong> [PEC se disponibile]
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
            <li>Gestione delle prenotazioni degli appuntamenti</li>
            <li>Erogazione dei servizi richiesti</li>
            <li>Comunicazioni relative agli appuntamenti (conferme, promemoria)</li>
            <li>Adempimento degli obblighi contrattuali e fiscali</li>
          </ul>
          <p className="text-gray-700 text-sm mt-2 font-medium">
            I Suoi dati NON saranno utilizzati per finalità di marketing, profilazione o comunicati a terzi
            per scopi commerciali.
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
            <li>Dati anagrafici: nome, cognome</li>
            <li>Dati di contatto: email, numero di telefono</li>
            <li>Dati di accesso: password (criptata)</li>
            <li>Dati relativi alle prenotazioni: data, ora, servizi richiesti</li>
          </ul>
        </section>

        {/* Conservazione */}
        <section>
          <h4 className="font-semibold text-gray-900 mb-2">5. Periodo di Conservazione</h4>
          <p className="text-gray-700 text-sm leading-relaxed">
            I Suoi dati personali saranno conservati per il tempo strettamente necessario al perseguimento
            delle finalità sopra indicate e, in ogni caso, fino alla richiesta di cancellazione del Suo account.
            I dati necessari per adempimenti fiscali saranno conservati per il periodo previsto dalla legge (10 anni).
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
          <p className="text-gray-700 text-sm">
            I Suoi dati personali non saranno comunicati a terzi, salvo nei casi previsti dalla legge.
            I dati sono trattati internamente dal personale autorizzato e non sono trasferiti al di fuori
            dell'Unione Europea.
          </p>
        </section>

        {/* Sicurezza */}
        <section>
          <h4 className="font-semibold text-gray-900 mb-2">8. Misure di Sicurezza</h4>
          <p className="text-gray-700 text-sm">
            Il Titolare adotta misure di sicurezza tecniche e organizzative adeguate per proteggere i dati
            personali da accessi non autorizzati, perdita, distruzione o divulgazione.
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
            <strong>Versione:</strong> 1.0<br />
            <strong>Data:</strong> Ottobre 2025
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




