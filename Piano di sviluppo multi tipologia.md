# POLTRONA - Parte 1: Multi-Tipologia e Terminologia

## Indice
1. [Panoramica](#panoramica)
2. [Decisioni Architetturali](#decisioni-architetturali)
3. [Fase 1 - Database Schema](#fase-1---database-schema)
4. [Fase 2 - Dizionario Terminologico](#fase-2---dizionario-terminologico)
5. [Fase 3 - Context e Hook](#fase-3---context-e-hook)
6. [Fase 4 - Sostituzione Testi UI](#fase-4---sostituzione-testi-ui)
7. [Checklist Implementazione](#checklist-implementazione)

---

## Panoramica

### Obiettivo
Trasformare POLTRONA da app solo per barbieri a piattaforma multi-tipologia che supporta:
- **Barbershop** (barbieri)
- **Hairdresser** (parrucchieri/e)
- **Beauty Salon** (estetiste)

### Problema Risolto
L'app parla solo di "barbiere" ovunque → esclude parrucchieri e estetiste. Ogni tipo di attività deve sentirsi "a casa" con la terminologia corretta.

### Vincoli
- Shop esistenti rimangono `barbershop` (migrazione automatica silenziosa)
- Il tipo shop si sceglie SOLO alla creazione, non modificabile dopo
- Email transazionali NON vengono modificate in questa fase

---

## Decisioni Architetturali

### Tipologie Shop

| Tipo | Codice | Target |
|------|--------|--------|
| Barbershop | `barbershop` | Barbieri, barber shop |
| Salone Parrucchiere | `hairdresser` | Parrucchieri/e, saloni |
| Centro Estetico | `beauty_salon` | Estetiste, centri estetici |

### Genere Staff
Ogni membro staff ha un genere che determina la declinazione dei termini:
- `male` → "Parrucchiere", "il tuo parrucchiere"
- `female` → "Parrucchiera", "la tua parrucchiera"
- `neutral` → Default maschile

---

## Fase 1 - Database Schema

### 1.1 Modifica Tabella `shops`

```sql
-- Aggiungere tipo shop
ALTER TABLE shops 
ADD COLUMN IF NOT EXISTS shop_type TEXT 
DEFAULT 'barbershop' 
CHECK (shop_type IN ('barbershop', 'hairdresser', 'beauty_salon'));

-- Commento per documentazione
COMMENT ON COLUMN shops.shop_type IS 'Tipo di attività: barbershop, hairdresser, beauty_salon. Impostato alla creazione, non modificabile.';
```

### 1.2 Modifica Tabella Staff

> **NOTA:** Verifica il nome corretto della tabella staff nel progetto (potrebbe essere `shop_staff`, `staff`, `barbers`, ecc.)

```sql
-- Aggiungere genere staff
ALTER TABLE shop_staff 
ADD COLUMN IF NOT EXISTS gender TEXT 
DEFAULT 'male' 
CHECK (gender IN ('male', 'female', 'neutral'));

COMMENT ON COLUMN shop_staff.gender IS 'Genere per declinazione terminologia: male, female, neutral';
```

### 1.3 Migrazione Shop Esistenti

```sql
-- Tutti gli shop esistenti diventano barbershop (già default, ma per sicurezza)
UPDATE shops 
SET shop_type = 'barbershop' 
WHERE shop_type IS NULL;
```

---

## Fase 2 - Dizionario Terminologico

### 2.1 Struttura File

Creare file: `src/config/terminology.ts`

```typescript
// ==========================================
// TIPI
// ==========================================

export type ShopType = 'barbershop' | 'hairdresser' | 'beauty_salon';
export type Gender = 'male' | 'female' | 'neutral';

export interface GenderedTerm {
  male: string;
  female: string;
  neutral: string;
  plural: string;
}

export interface ShopTerminology {
  // Identificazione
  type_name: string;
  type_description: string;
  
  // Professionista
  professional: GenderedTerm;
  professional_article: GenderedTerm;
  
  // Spazi
  workspace: string;
  workspace_plural: string;
  shop: string;
  shop_generic: string;
  
  // Clienti
  client: string;
  client_plural: string;
  welcome_client: GenderedTerm;
  
  // Azioni
  booking_cta: GenderedTerm;
  select_professional: GenderedTerm;
  no_professionals: string;
  
  // Appuntamenti
  appointment: string;
  appointment_plural: string;
  new_appointment: string;
  
  // Messaggi
  professional_not_available: GenderedTerm;
}

// ==========================================
// DIZIONARIO COMPLETO
// ==========================================

export const terminology: Record<ShopType, ShopTerminology> = {
  
  // ==========================================
  // BARBERSHOP
  // ==========================================
  barbershop: {
    type_name: "Barbershop",
    type_description: "Per barbieri e barber shop",
    
    professional: {
      male: "Barbiere",
      female: "Barbiera",
      neutral: "Barbiere",
      plural: "Barbieri"
    },
    professional_article: {
      male: "il barbiere",
      female: "la barbiera",
      neutral: "il barbiere",
      plural: "i barbieri"
    },
    
    workspace: "Poltrona",
    workspace_plural: "Poltrone",
    shop: "Barbershop",
    shop_generic: "Negozio",
    
    client: "Cliente",
    client_plural: "Clienti",
    welcome_client: {
      male: "Benvenuto",
      female: "Benvenuta",
      neutral: "Benvenuto",
      plural: "Benvenuti"
    },
    
    booking_cta: {
      male: "Prenota dal tuo barbiere",
      female: "Prenota dalla tua barbiera",
      neutral: "Prenota dal tuo barbiere",
      plural: "Prenota"
    },
    select_professional: {
      male: "Scegli il tuo barbiere",
      female: "Scegli la tua barbiera",
      neutral: "Scegli il tuo barbiere",
      plural: "Scegli il barbiere"
    },
    no_professionals: "Nessun barbiere disponibile",
    
    appointment: "Appuntamento",
    appointment_plural: "Appuntamenti",
    new_appointment: "Nuovo appuntamento",
    
    professional_not_available: {
      male: "Il barbiere non è disponibile",
      female: "La barbiera non è disponibile",
      neutral: "Il barbiere non è disponibile",
      plural: "I barbieri non sono disponibili"
    }
  },
  
  // ==========================================
  // HAIRDRESSER (Parrucchiere)
  // ==========================================
  hairdresser: {
    type_name: "Salone parrucchiere",
    type_description: "Per parrucchieri e saloni di bellezza",
    
    professional: {
      male: "Parrucchiere",
      female: "Parrucchiera",
      neutral: "Parrucchiere",
      plural: "Parrucchieri"
    },
    professional_article: {
      male: "il parrucchiere",
      female: "la parrucchiera",
      neutral: "il parrucchiere",
      plural: "i parrucchieri"
    },
    
    workspace: "Postazione",
    workspace_plural: "Postazioni",
    shop: "Salone",
    shop_generic: "Salone",
    
    client: "Cliente",
    client_plural: "Clienti",
    welcome_client: {
      male: "Benvenuto",
      female: "Benvenuta",
      neutral: "Benvenuta",
      plural: "Benvenuti"
    },
    
    booking_cta: {
      male: "Prenota dal tuo parrucchiere",
      female: "Prenota dalla tua parrucchiera",
      neutral: "Prenota dal tuo parrucchiere",
      plural: "Prenota"
    },
    select_professional: {
      male: "Scegli il tuo parrucchiere",
      female: "Scegli la tua parrucchiera",
      neutral: "Scegli il tuo parrucchiere",
      plural: "Scegli il parrucchiere"
    },
    no_professionals: "Nessun parrucchiere disponibile",
    
    appointment: "Appuntamento",
    appointment_plural: "Appuntamenti",
    new_appointment: "Nuovo appuntamento",
    
    professional_not_available: {
      male: "Il parrucchiere non è disponibile",
      female: "La parrucchiera non è disponibile",
      neutral: "Il parrucchiere non è disponibile",
      plural: "I parrucchieri non sono disponibili"
    }
  },
  
  // ==========================================
  // BEAUTY SALON (Centro estetico)
  // ==========================================
  beauty_salon: {
    type_name: "Centro estetico",
    type_description: "Per estetiste e centri estetici",
    
    professional: {
      male: "Estetista",
      female: "Estetista",
      neutral: "Estetista",
      plural: "Estetiste"
    },
    professional_article: {
      male: "l'estetista",
      female: "l'estetista",
      neutral: "l'estetista",
      plural: "le estetiste"
    },
    
    workspace: "Cabina",
    workspace_plural: "Cabine",
    shop: "Centro estetico",
    shop_generic: "Centro",
    
    client: "Cliente",
    client_plural: "Clienti",
    welcome_client: {
      male: "Benvenuto",
      female: "Benvenuta",
      neutral: "Benvenuta",
      plural: "Benvenuti"
    },
    
    booking_cta: {
      male: "Prenota il tuo trattamento",
      female: "Prenota il tuo trattamento",
      neutral: "Prenota il tuo trattamento",
      plural: "Prenota"
    },
    select_professional: {
      male: "Scegli il tuo estetista",
      female: "Scegli la tua estetista",
      neutral: "Scegli l'estetista",
      plural: "Scegli l'estetista"
    },
    no_professionals: "Nessuna estetista disponibile",
    
    appointment: "Appuntamento",
    appointment_plural: "Appuntamenti",
    new_appointment: "Nuovo appuntamento",
    
    professional_not_available: {
      male: "L'estetista non è disponibile",
      female: "L'estetista non è disponibile",
      neutral: "L'estetista non è disponibile",
      plural: "Le estetiste non sono disponibili"
    }
  }
};
```

### 2.2 Helper Functions

Aggiungere nello stesso file:

```typescript
// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Ottiene il termine corretto in base al genere
 */
export function getGenderedTerm(
  term: GenderedTerm, 
  gender: Gender = 'neutral'
): string {
  return term[gender] || term.neutral;
}

/**
 * Ottiene la terminologia completa per un tipo di shop
 */
export function getShopTerminology(shopType: ShopType): ShopTerminology {
  return terminology[shopType] || terminology.barbershop;
}

/**
 * Shorthand per ottenere un termine specifico
 */
export function t(
  shopType: ShopType,
  key: keyof ShopTerminology,
  gender?: Gender
): string {
  const terms = getShopTerminology(shopType);
  const value = terms[key];
  
  if (typeof value === 'string') {
    return value;
  }
  
  // È un GenderedTerm
  return getGenderedTerm(value as GenderedTerm, gender);
}
```

---

## Fase 3 - Context e Hook

### 3.1 Terminology Context

Creare file: `src/contexts/TerminologyContext.tsx`

```typescript
import React, { createContext, useContext, useMemo } from 'react';
import { 
  ShopType, 
  Gender, 
  ShopTerminology, 
  GenderedTerm,
  getShopTerminology,
  getGenderedTerm 
} from '@/config/terminology';
import { useShop } from '@/hooks/useShop'; // Hook esistente per ottenere shop corrente

// ==========================================
// TIPI CONTEXT
// ==========================================

interface TerminologyContextValue {
  shopType: ShopType;
  terms: ShopTerminology;
  
  // Helper per termini con genere
  professional: (gender?: Gender) => string;
  professionalPlural: () => string;
  professionalArticle: (gender?: Gender) => string;
  selectProfessional: (gender?: Gender) => string;
  bookingCta: (gender?: Gender) => string;
  welcomeClient: (gender?: Gender) => string;
  professionalNotAvailable: (gender?: Gender) => string;
  
  // Termini semplici (senza genere)
  workspace: string;
  workspacePlural: string;
  shop: string;
  shopGeneric: string;
  client: string;
  clientPlural: string;
  appointment: string;
  appointmentPlural: string;
  newAppointment: string;
  noProfessionals: string;
  
  // Info tipo shop
  typeName: string;
  typeDescription: string;
}

// ==========================================
// CONTEXT
// ==========================================

const TerminologyContext = createContext<TerminologyContextValue | null>(null);

// ==========================================
// PROVIDER
// ==========================================

export function TerminologyProvider({ children }: { children: React.ReactNode }) {
  const { shop } = useShop();
  const shopType: ShopType = shop?.shop_type || 'barbershop';
  const terms = getShopTerminology(shopType);
  
  const value = useMemo<TerminologyContextValue>(() => ({
    shopType,
    terms,
    
    // Helper con genere
    professional: (gender?: Gender) => getGenderedTerm(terms.professional, gender),
    professionalPlural: () => terms.professional.plural,
    professionalArticle: (gender?: Gender) => getGenderedTerm(terms.professional_article, gender),
    selectProfessional: (gender?: Gender) => getGenderedTerm(terms.select_professional, gender),
    bookingCta: (gender?: Gender) => getGenderedTerm(terms.booking_cta, gender),
    welcomeClient: (gender?: Gender) => getGenderedTerm(terms.welcome_client, gender),
    professionalNotAvailable: (gender?: Gender) => getGenderedTerm(terms.professional_not_available, gender),
    
    // Termini semplici
    workspace: terms.workspace,
    workspacePlural: terms.workspace_plural,
    shop: terms.shop,
    shopGeneric: terms.shop_generic,
    client: terms.client,
    clientPlural: terms.client_plural,
    appointment: terms.appointment,
    appointmentPlural: terms.appointment_plural,
    newAppointment: terms.new_appointment,
    noProfessionals: terms.no_professionals,
    
    // Info tipo shop
    typeName: terms.type_name,
    typeDescription: terms.type_description,
  }), [shopType, terms]);
  
  return (
    <TerminologyContext.Provider value={value}>
      {children}
    </TerminologyContext.Provider>
  );
}

// ==========================================
// HOOK
// ==========================================

export function useTerminology(): TerminologyContextValue {
  const context = useContext(TerminologyContext);
  if (!context) {
    throw new Error('useTerminology must be used within TerminologyProvider');
  }
  return context;
}
```

### 3.2 Hook per Staff con Genere

Creare file: `src/hooks/useStaffTerminology.ts`

```typescript
import { useTerminology } from '@/contexts/TerminologyContext';
import { Gender } from '@/config/terminology';

interface StaffMember {
  id: string;
  name: string;
  gender: Gender;
  // ... altri campi esistenti
}

/**
 * Hook per ottenere terminologia specifica per uno staff member
 * 
 * Uso:
 * const { professionalLabel, selectLabel } = useStaffTerminology(selectedStaff);
 */
export function useStaffTerminology(staff: StaffMember | null | undefined) {
  const terminology = useTerminology();
  
  if (!staff) {
    // Default a neutro se non c'è staff selezionato
    return {
      ...terminology,
      professionalLabel: terminology.professional(),
      selectLabel: terminology.selectProfessional(),
      articleLabel: terminology.professionalArticle(),
      notAvailableLabel: terminology.professionalNotAvailable(),
    };
  }
  
  return {
    ...terminology,
    professionalLabel: terminology.professional(staff.gender),
    selectLabel: terminology.selectProfessional(staff.gender),
    articleLabel: terminology.professionalArticle(staff.gender),
    notAvailableLabel: terminology.professionalNotAvailable(staff.gender),
  };
}
```

### 3.3 Integrazione nel Provider Principale

Modificare il file principale dell'app (es. `src/App.tsx` o `src/main.tsx`):

```typescript
import { TerminologyProvider } from '@/contexts/TerminologyContext';

function App() {
  return (
    <AuthProvider>
      <ShopProvider>
        <TerminologyProvider>
          {/* ... resto dell'app */}
          <Router />
        </TerminologyProvider>
      </ShopProvider>
    </AuthProvider>
  );
}
```

---

## Fase 4 - Sostituzione Testi UI

### 4.1 Priorità Sostituzione

Ordine di priorità per sostituire i testi hardcoded:

| Priorità | Area | Descrizione |
|----------|------|-------------|
| 1 | Booking cliente | Pagina prenotazione pubblica |
| 2 | Calendario | Vista appuntamenti staff |
| 3 | Dashboard | Home page staff |
| 4 | Scheda cliente | Dettaglio cliente |
| 5 | Lista staff | Gestione collaboratori |
| 6 | Impostazioni | Settings shop |
| 7 | Navigazione | Menu, sidebar, header |

### 4.2 Pattern di Sostituzione

**PRIMA (hardcoded):**
```tsx
function BookingPage() {
  return (
    <div>
      <h1>Scegli il tuo barbiere</h1>
      <p>Nessun barbiere disponibile</p>
      <label>Poltrona</label>
    </div>
  );
}
```

**DOPO (dinamico):**
```tsx
function BookingPage() {
  const { selectProfessional, noProfessionals, workspace } = useTerminology();
  const selectedStaff = /* ... */;
  
  return (
    <div>
      <h1>{selectProfessional(selectedStaff?.gender)}</h1>
      <p>{noProfessionals}</p>
      <label>{workspace}</label>
    </div>
  );
}
```

### 4.3 Casi Particolari

**Liste di staff misti (uomini e donne):**
```tsx
// Usare sempre il plurale
const { professionalPlural } = useTerminology();
<h2>{professionalPlural()}</h2>  // "Parrucchieri", "Barbieri", "Estetiste"
```

**Riferimento a staff specifico:**
```tsx
// Usare il genere dello staff
const { professionalArticle } = useTerminology();
const staff = getStaffById(id);

<p>Appuntamento con {professionalArticle(staff.gender)}</p>
// Output: "Appuntamento con il parrucchiere" 
// oppure: "Appuntamento con la parrucchiera"
```

**Selezione staff nel booking:**
```tsx
// Cambia il testo in base allo staff selezionato
const { useStaffTerminology } = useStaffTerminology(selectedStaff);
<Button>{selectLabel}</Button>
// Output dinamico in base al genere
```

### 4.4 Ricerca Testi da Sostituire

Eseguire ricerca nel codebase per queste stringhe (case insensitive):

```bash
# Stringhe da cercare
barbiere
barber
poltrona
barbershop
"scegli il tuo"
"prenota"
```

Ogni occorrenza va valutata:
- Se è testo UI visibile → sostituire con termine dinamico
- Se è nome variabile/funzione → lasciare (o rinominare per coerenza)
- Se è in commenti → aggiornare per chiarezza

### 4.5 Onboarding Nuovo Shop

Modificare il flusso di registrazione nuovo shop per includere la selezione del tipo:

```tsx
// Step 1 della registrazione
function ShopTypeSelection({ onSelect }: { onSelect: (type: ShopType) => void }) {
  const options = [
    {
      type: 'barbershop' as ShopType,
      name: 'Barbershop',
      description: 'Per barbieri e barber shop',
      icon: '💈'
    },
    {
      type: 'hairdresser' as ShopType,
      name: 'Salone parrucchiere',
      description: 'Per parrucchieri e saloni di bellezza',
      icon: '✂️'
    },
    {
      type: 'beauty_salon' as ShopType,
      name: 'Centro estetico',
      description: 'Per estetiste e centri estetici',
      icon: '💅'
    }
  ];

  return (
    <div>
      <h1>Che tipo di attività apri?</h1>
      <div className="grid gap-4">
        {options.map(option => (
          <button
            key={option.type}
            onClick={() => onSelect(option.type)}
            className="p-4 border rounded-lg text-left hover:border-primary"
          >
            <span className="text-2xl">{option.icon}</span>
            <h3 className="font-medium">{option.name}</h3>
            <p className="text-sm text-gray-500">{option.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
```

### 4.6 Aggiunta Staff con Genere

Modificare il form di creazione/modifica staff:

```tsx
function StaffForm({ staff, onSave }) {
  const [gender, setGender] = useState<Gender>(staff?.gender || 'male');
  
  return (
    <form>
      {/* ... altri campi esistenti ... */}
      
      <div>
        <label>Genere</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="gender"
              value="male"
              checked={gender === 'male'}
              onChange={() => setGender('male')}
            />
            Uomo
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="gender"
              value="female"
              checked={gender === 'female'}
              onChange={() => setGender('female')}
            />
            Donna
          </label>
        </div>
        <p className="text-xs text-gray-500">
          Usato per personalizzare i testi (es. "il tuo parrucchiere" / "la tua parrucchiera")
        </p>
      </div>
      
      {/* ... resto del form ... */}
    </form>
  );
}
```

---

## Checklist Implementazione

### Database
- [ ] Aggiungere colonna `shop_type` a `shops`
- [ ] Aggiungere colonna `gender` a tabella staff
- [ ] Eseguire migrazione shop esistenti → `barbershop`
- [ ] Testare che default funzionino

### Dizionario
- [ ] Creare file `src/config/terminology.ts`
- [ ] Definire tipi TypeScript
- [ ] Definire termini per `barbershop`
- [ ] Definire termini per `hairdresser`
- [ ] Definire termini per `beauty_salon`
- [ ] Creare helper functions

### Context e Hook
- [ ] Creare `TerminologyContext.tsx`
- [ ] Creare `useTerminology` hook
- [ ] Creare `useStaffTerminology` hook
- [ ] Integrare `TerminologyProvider` nell'app
- [ ] Testare che context funzioni

### Sostituzione Testi
- [ ] Sostituire testi in Booking
- [ ] Sostituire testi in Calendario
- [ ] Sostituire testi in Dashboard
- [ ] Sostituire testi in Scheda Cliente
- [ ] Sostituire testi in Lista Staff
- [ ] Sostituire testi in Impostazioni
- [ ] Sostituire testi in Navigazione

### Onboarding
- [ ] Aggiungere step selezione tipo shop alla registrazione
- [ ] Aggiungere campo genere alla creazione staff
- [ ] Aggiungere campo genere alla modifica staff

### Test
- [ ] Test creazione shop `barbershop`
- [ ] Test creazione shop `hairdresser`
- [ ] Test creazione shop `beauty_salon`
- [ ] Test terminologia dinamica per ogni tipo
- [ ] Test genere staff `male`
- [ ] Test genere staff `female`
- [ ] Test staff misti in lista

---

## Note per lo Sviluppatore

1. **Il tipo shop non è modificabile dopo la creazione** - Non creare UI per cambiarlo nelle impostazioni

2. **Default per shop esistenti** - La migrazione SQL imposta automaticamente `barbershop`, non serve logica applicativa

3. **Genere staff obbligatorio** - Default `male`, ma mostrare sempre la selezione nel form

4. **Verifica nome tabella staff** - Il documento usa `shop_staff`, verificare il nome reale nel progetto

5. **Non modificare le email** - Le email transazionali rimangono invariate in questa fase

6. **Ordine di implementazione** - Seguire le fasi in ordine: prima DB, poi dizionario, poi context, infine UI

---
