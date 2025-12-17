import React from 'react';
import { FileText, Scale, AlertCircle, Gavel } from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';

interface TermsOfServiceProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TermsOfService: React.FC<TermsOfServiceProps> = ({ isOpen, onClose }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Termini di Servizio" size="large">
      <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-4">
        {/* Introduzione */}
        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-blue-600" />
            Termini e Condizioni di Utilizzo del Servizio Poltrona
          </h3>
          <p className="text-gray-700 text-sm leading-relaxed">
            I presenti Termini di Servizio regolano l'utilizzo della piattaforma Poltrona, 
            un sistema di gestione appuntamenti per barbieri e parrucchieri. 
            Utilizzando il servizio, l'utente accetta integralmente i presenti termini.
          </p>
          <p className="text-gray-700 text-sm mt-2">
            <strong>Data di entrata in vigore:</strong> Dicembre 2025<br />
            <strong>Versione:</strong> 1.0
          </p>
        </section>

        {/* Definizioni */}
        <section>
          <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
            <Scale className="w-4 h-4 mr-2 text-purple-600" />
            1. Definizioni
          </h4>
          <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
            <li><strong>"Servizio"</strong> indica la piattaforma Poltrona e tutti i servizi ad essa connessi</li>
            <li><strong>"Utente"</strong> indica chiunque acceda e utilizzi il Servizio</li>
            <li><strong>"Titolare"</strong> indica Abruzzo.AI, fornitore del Servizio</li>
            <li><strong>"Negozio"</strong> indica l'attività commerciale registrata sulla piattaforma</li>
            <li><strong>"Cliente"</strong> indica l'utente finale che prenota appuntamenti tramite il Servizio</li>
          </ul>
        </section>

        {/* Accettazione */}
        <section>
          <h4 className="font-semibold text-gray-900 mb-2">2. Accettazione dei Termini</h4>
          <p className="text-gray-700 text-sm leading-relaxed">
            L'accesso e l'utilizzo del Servizio implica l'accettazione integrale e senza riserve 
            dei presenti Termini di Servizio. Se non si accettano questi termini, è necessario 
            astenersi dall'utilizzare il Servizio.
          </p>
        </section>

        {/* Descrizione del Servizio */}
        <section>
          <h4 className="font-semibold text-gray-900 mb-2">3. Descrizione del Servizio</h4>
          <p className="text-gray-700 text-sm leading-relaxed mb-2">
            Poltrona è una piattaforma software che consente a:
          </p>
          <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
            <li>Negozi di barbieri e parrucchieri di gestire appuntamenti, clienti, staff e servizi</li>
            <li>Clienti di prenotare appuntamenti online</li>
            <li>Amministratori di negozi di configurare orari, servizi e personale</li>
          </ul>
          <p className="text-gray-700 text-sm mt-2">
            Il Servizio è fornito "così com'è" e può essere modificato o interrotto in qualsiasi momento 
            senza preavviso.
          </p>
        </section>

        {/* Registrazione e Account */}
        <section>
          <h4 className="font-semibold text-gray-900 mb-2">4. Registrazione e Account</h4>
          <p className="text-gray-700 text-sm leading-relaxed mb-2">
            Per utilizzare il Servizio come amministratore di negozio è necessario:
          </p>
          <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
            <li>Essere maggiorenni e avere la capacità giuridica di stipulare contratti</li>
            <li>Fornire informazioni veritiere, accurate e complete</li>
            <li>Mantenere la sicurezza dell'account e della password</li>
            <li>Notificare immediatamente eventuali accessi non autorizzati</li>
          </ul>
          <p className="text-gray-700 text-sm mt-2">
            Il Titolare si riserva il diritto di sospendere o cancellare account che violino 
            i presenti termini o utilizzino il servizio in modo improprio.
          </p>
        </section>

        {/* Obblighi dell'Utente */}
        <section>
          <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
            <AlertCircle className="w-4 h-4 mr-2 text-orange-600" />
            5. Obblighi dell'Utente
          </h4>
          <p className="text-gray-700 text-sm leading-relaxed mb-2">
            L'utente si impegna a:
          </p>
          <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
            <li>Utilizzare il Servizio esclusivamente per scopi leciti e conformi alla normativa vigente</li>
            <li>Non tentare di accedere ad aree riservate o violare misure di sicurezza</li>
            <li>Non utilizzare il Servizio per attività fraudolente o illegali</li>
            <li>Non interferire con il funzionamento del Servizio o dei server</li>
            <li>Rispettare i diritti di proprietà intellettuale del Titolare e di terzi</li>
            <li>Non trasmettere virus, malware o codici dannosi</li>
            <li>Rispettare la privacy e i dati personali di altri utenti</li>
          </ul>
        </section>

        {/* Limitazioni di Responsabilità */}
        <section>
          <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
            <Gavel className="w-4 h-4 mr-2 text-red-600" />
            6. Limitazioni di Responsabilità
          </h4>
          <p className="text-gray-700 text-sm leading-relaxed mb-2">
            Il Servizio è fornito "così com'è" senza garanzie di alcun tipo, esplicite o implicite. 
            Il Titolare non garantisce:
          </p>
          <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
            <li>Che il Servizio sia ininterrotto, privo di errori o sicuro</li>
            <li>Che i risultati ottenibili dal Servizio siano accurati o affidabili</li>
            <li>Che eventuali difetti siano corretti</li>
          </ul>
          <p className="text-gray-700 text-sm mt-2">
            Il Titolare non sarà responsabile per danni diretti, indiretti, incidentali o consequenziali 
            derivanti dall'utilizzo o dall'impossibilità di utilizzare il Servizio, salvo nei casi di 
            dolo o colpa grave.
          </p>
        </section>

        {/* Proprietà Intellettuale */}
        <section>
          <h4 className="font-semibold text-gray-900 mb-2">7. Proprietà Intellettuale</h4>
          <p className="text-gray-700 text-sm leading-relaxed">
            Tutti i contenuti del Servizio, inclusi ma non limitati a testi, grafica, loghi, icone, 
            immagini, software e codici, sono di proprietà del Titolare o dei suoi licenzianti e sono 
            protetti da leggi sul copyright e altre leggi sulla proprietà intellettuale.
          </p>
          <p className="text-gray-700 text-sm mt-2">
            È vietata la riproduzione, distribuzione, modifica o creazione di opere derivate senza 
            il consenso scritto del Titolare.
          </p>
        </section>

        {/* Modifiche al Servizio */}
        <section>
          <h4 className="font-semibold text-gray-900 mb-2">8. Modifiche al Servizio e ai Termini</h4>
          <p className="text-gray-700 text-sm leading-relaxed">
            Il Titolare si riserva il diritto di modificare, sospendere o interrompere il Servizio 
            in qualsiasi momento, con o senza preavviso. I presenti Termini possono essere modificati 
            periodicamente. Le modifiche entreranno in vigore dalla pubblicazione sul Servizio.
          </p>
          <p className="text-gray-700 text-sm mt-2">
            L'utilizzo continuato del Servizio dopo le modifiche implica l'accettazione dei nuovi termini.
          </p>
        </section>

        {/* Risoluzione delle Controversie */}
        <section>
          <h4 className="font-semibold text-gray-900 mb-2">9. Risoluzione delle Controversie</h4>
          <p className="text-gray-700 text-sm leading-relaxed">
            Qualsiasi controversia relativa ai presenti Termini sarà regolata dalla legge italiana. 
            Le parti si impegnano a tentare una risoluzione amichevole delle controversie mediante 
            negoziazione diretta.
          </p>
          <p className="text-gray-700 text-sm mt-2">
            In caso di mancato accordo, la competenza esclusiva per qualsiasi controversia spetta 
            al Foro competente secondo la normativa italiana vigente.
          </p>
        </section>

        {/* Recesso */}
        <section>
          <h4 className="font-semibold text-gray-900 mb-2">10. Recesso e Cancellazione Account</h4>
          <p className="text-gray-700 text-sm leading-relaxed">
            L'utente può richiedere la cancellazione del proprio account in qualsiasi momento 
            contattando il supporto. Il Titolare si riserva il diritto di sospendere o cancellare 
            account che violino i presenti termini.
          </p>
          <p className="text-gray-700 text-sm mt-2">
            In caso di cancellazione, i dati dell'utente saranno eliminati secondo quanto previsto 
            dalla normativa sulla privacy vigente.
          </p>
        </section>

        {/* Disposizioni Finali */}
        <section>
          <h4 className="font-semibold text-gray-900 mb-2">11. Disposizioni Finali</h4>
          <p className="text-gray-700 text-sm leading-relaxed">
            Se una qualsiasi disposizione dei presenti Termini risultasse nulla o inefficace, 
            le rimanenti disposizioni continueranno ad avere piena efficacia.
          </p>
          <p className="text-gray-700 text-sm mt-2">
            I presenti Termini costituiscono l'intero accordo tra le parti riguardo all'utilizzo 
            del Servizio e sostituiscono tutti gli accordi precedenti.
          </p>
        </section>

        {/* Contatti */}
        <section>
          <h4 className="font-semibold text-gray-900 mb-2">12. Contatti</h4>
          <p className="text-gray-700 text-sm">
            Per qualsiasi domanda o richiesta relativa ai presenti Termini di Servizio, 
            è possibile contattare:
          </p>
          <p className="text-gray-700 text-sm mt-2">
            <strong>Abruzzo.AI</strong><br />
            Email: info@abruzzo.ai<br />
            Sito web: www.abruzzo.ai
          </p>
        </section>

        {/* Footer Note */}
        <div className="bg-blue-50 rounded-lg p-4 mt-6">
          <p className="text-blue-800 text-xs text-center">
            Utilizzando il Servizio Poltrona, Lei accetta integralmente i presenti Termini di Servizio. 
            Si prega di leggere attentamente tutti i termini prima di procedere.
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

