### Obiettivo
Implementare un sistema intelligente per:
1. Salvare il **profilo capelli** di ogni cliente (tipo, lunghezza, storia colore)
2. Mostrare lo **storico delle ultime 3 visite** al parrucchiere
3. **Calcolare automaticamente la durata** dell'appuntamento in base al profilo
4. Non assillare la cliente con domande ripetute

### Problema Risolto
Le clienti prenotano appuntamenti con durata sbagliata (es. 1h per un servizio che ne richiede 2h30) perché non considerano il loro tipo di capello. Questo causa ritardi a catena.

### Vincoli
- Profilo capelli è **separato per ogni shop** (non globale)
- Storico mostra solo **ultime 3 visite**
- Durata: solo **stimata**, no tracking durata reale
- Questionario disponibile **solo per `hairdresser`**
- Staff **può modificare** il profilo capelli della cliente

---

## Decisioni Architetturali

### Profilo Capelli
| Aspetto | Decisione |
|---------|-----------|
| Scope | Per shop (ogni shop ha il suo profilo per la cliente) |
| Modificabile da | Cliente (questionario) + Staff (scheda cliente) |
| Scadenza | Mai, ma dopo 6 mesi chiede conferma |
| Obbligatorio | Solo se questionario attivo E servizi variabili |

### Questionario
| Aspetto | Decisione |
|---------|-----------|
| Disponibilità | Solo `hairdresser` |
| Attivazione | Toggle ON/OFF in impostazioni shop |
| Obbligatorietà | Se attivo → obbligatorio |
| Domande | Max 3 (tipo, lunghezza, situazione colore) |

### Storico
| Aspetto | Decisione |
|---------|-----------|
| Numero visite | Ultime 3 |
| Dove visibile | Scheda cliente + Modal appuntamento |
| Dati mostrati | Data, servizi, staff, durata |

---

## Fase 1 - Database Schema

### 1.1 Nuova Tabella `client_hair_profiles`

```sql
CREATE TABLE client_hair_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relazioni
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  
  -- Caratteristiche capello
  hair_type TEXT CHECK (hair_type IN (
    'straight_fine',    -- Liscio/Fine
    'wavy_medium',      -- Mosso/Medio  
    'curly_thick',      -- Riccio/Spesso
    'very_curly_afro'   -- Molto riccio/Afro
  )),
  
  hair_length TEXT CHECK (hair_length IN (
    'short',       -- Corti (sopra orecchie)
    'medium',      -- Medi (spalle)
    'long',        -- Lunghi (sotto spalle)
    'very_long'    -- Molto lunghi (metà schiena+)
  )),
  
  -- Storia colore
  has_color_history BOOLEAN DEFAULT false,
  color_situation TEXT CHECK (color_situation IN (
    'virgin',           -- Mai colorati
    'roots_touch_up',   -- Ritocco ricrescita
    'full_color_change', -- Cambio colore completo
    'color_correction'  -- Correzione colore
  )),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  
  -- Un solo profilo per cliente per shop
  UNIQUE(client_id, shop_id)
);

-- Indici per performance
CREATE INDEX idx_hair_profiles_client ON client_hair_profiles(client_id);
CREATE INDEX idx_hair_profiles_shop ON client_hair_profiles(shop_id);

-- Trigger per updated_at automatico
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_client_hair_profiles_updated_at
  BEFORE UPDATE ON client_hair_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Commenti documentazione
COMMENT ON TABLE client_hair_profiles IS 'Profilo capelli cliente per shop - usato per calcolo durata appuntamenti';
COMMENT ON COLUMN client_hair_profiles.hair_type IS 'Tipo di capello: straight_fine, wavy_medium, curly_thick, very_curly_afro';
COMMENT ON COLUMN client_hair_profiles.hair_length IS 'Lunghezza capelli: short, medium, long, very_long';
COMMENT ON COLUMN client_hair_profiles.color_situation IS 'Situazione colore attuale per servizi colorazione';
```

### 1.2 Modifica Tabella `shops`

```sql
-- Flag per abilitare questionario capelli (solo per hairdresser)
ALTER TABLE shops 
ADD COLUMN IF NOT EXISTS hair_questionnaire_enabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN shops.hair_questionnaire_enabled IS 'Se true, mostra questionario capelli durante booking. Rilevante solo per shop_type=hairdresser';
```

### 1.3 Modifica Tabella `services`

```sql
-- Flag per servizi a durata variabile (dipende dal tipo capello)
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS is_duration_variable BOOLEAN DEFAULT false;

-- Configurazione moltiplicatori per calcolo durata
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS duration_config JSONB DEFAULT '{
  "base_minutes": 30,
  "hair_type_multipliers": {
    "straight_fine": 1.0,
    "wavy_medium": 1.15,
    "curly_thick": 1.25,
    "very_curly_afro": 1.4
  },
  "hair_length_multipliers": {
    "short": 1.0,
    "medium": 1.2,
    "long": 1.35,
    "very_long": 1.5
  },
  "color_situation_extra_minutes": {
    "virgin": 0,
    "roots_touch_up": 0,
    "full_color_change": 30,
    "color_correction": 60
  },
  "buffer_percentage": 10
}';

COMMENT ON COLUMN services.is_duration_variable IS 'Se true, la durata viene calcolata in base al profilo capelli del cliente';
COMMENT ON COLUMN services.duration_config IS 'Configurazione JSON per calcolo durata dinamica';
```

### 1.4 RLS Policies

```sql
-- Abilitare RLS
ALTER TABLE client_hair_profiles ENABLE ROW LEVEL SECURITY;

-- Staff può vedere/modificare profili del proprio shop
CREATE POLICY "Staff can manage hair profiles" ON client_hair_profiles
  FOR ALL USING (
    shop_id IN (
      SELECT shop_id FROM shop_staff WHERE user_id = auth.uid()
    )
  );

-- Cliente può vedere/modificare solo il proprio profilo
CREATE POLICY "Clients can manage own hair profile" ON client_hair_profiles
  FOR ALL USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()
    )
  );
```

---

## Fase 2 - Tipi e Costanti

### 2.1 Tipi TypeScript

Creare file: `src/types/hairProfile.ts`

```typescript
// ==========================================
// TIPI ENUM
// ==========================================

export type HairType = 'straight_fine' | 'wavy_medium' | 'curly_thick' | 'very_curly_afro';
export type HairLength = 'short' | 'medium' | 'long' | 'very_long';
export type ColorSituation = 'virgin' | 'roots_touch_up' | 'full_color_change' | 'color_correction';

// ==========================================
// INTERFACCE
// ==========================================

export interface HairProfile {
  id: string;
  client_id: string;
  shop_id: string;
  hair_type: HairType | null;
  hair_length: HairLength | null;
  has_color_history: boolean;
  color_situation: ColorSituation | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface DurationConfig {
  base_minutes: number;
  hair_type_multipliers: Record<HairType, number>;
  hair_length_multipliers: Record<HairLength, number>;
  color_situation_extra_minutes: Record<ColorSituation, number>;
  buffer_percentage: number;
}

export interface DurationResult {
  estimated_minutes: number;
  rounded_minutes: number;
  breakdown: {
    base: number;
    after_hair_type: number;
    after_length: number;
    color_extra: number;
    buffer: number;
    final: number;
  };
  display: string;
}

// ==========================================
// LABELS PER UI
// ==========================================

export const HAIR_TYPE_OPTIONS: Array<{
  value: HairType;
  label: string;
  icon: string;
  description: string;
}> = [
  { 
    value: 'straight_fine', 
    label: 'Liscio / Fine', 
    icon: '〰️', 
    description: 'Capelli dritti, sottili' 
  },
  { 
    value: 'wavy_medium', 
    label: 'Mosso / Medio', 
    icon: '🌊', 
    description: 'Leggermente ondulati' 
  },
  { 
    value: 'curly_thick', 
    label: 'Riccio / Spesso', 
    icon: '🔄', 
    description: 'Ricci definiti, corposi' 
  },
  { 
    value: 'very_curly_afro', 
    label: 'Molto riccio / Afro', 
    icon: '⭕', 
    description: 'Ricci stretti, voluminosi' 
  }
];

export const HAIR_LENGTH_OPTIONS: Array<{
  value: HairLength;
  label: string;
  description: string;
  visual: string;
}> = [
  { 
    value: 'short', 
    label: 'Corti', 
    description: 'Sopra le orecchie', 
    visual: '●○○○' 
  },
  { 
    value: 'medium', 
    label: 'Medi', 
    description: 'Fino alle spalle', 
    visual: '●●○○' 
  },
  { 
    value: 'long', 
    label: 'Lunghi', 
    description: 'Sotto le spalle', 
    visual: '●●●○' 
  },
  { 
    value: 'very_long', 
    label: 'Molto lunghi', 
    description: 'Metà schiena o più', 
    visual: '●●●●' 
  }
];

export const COLOR_SITUATION_OPTIONS: Array<{
  value: ColorSituation;
  label: string;
  description: string;
}> = [
  { 
    value: 'virgin', 
    label: 'Mai colorati', 
    description: 'Colore naturale' 
  },
  { 
    value: 'roots_touch_up', 
    label: 'Ritocco ricrescita', 
    description: 'Stesso colore, solo radici' 
  },
  { 
    value: 'full_color_change', 
    label: 'Cambio colore', 
    description: 'Voglio un colore diverso' 
  },
  { 
    value: 'color_correction', 
    label: 'Correzione colore', 
    description: 'Sistemare un colore precedente' 
  }
];

// ==========================================
// HELPER PER OTTENERE LABEL DA VALORE
// ==========================================

export function getHairTypeLabel(value: HairType | null): string {
  if (!value) return 'Non specificato';
  return HAIR_TYPE_OPTIONS.find(o => o.value === value)?.label || value;
}

export function getHairLengthLabel(value: HairLength | null): string {
  if (!value) return 'Non specificato';
  return HAIR_LENGTH_OPTIONS.find(o => o.value === value)?.label || value;
}

export function getColorSituationLabel(value: ColorSituation | null): string {
  if (!value) return 'Non specificato';
  return COLOR_SITUATION_OPTIONS.find(o => o.value === value)?.label || value;
}
```

---

## Fase 3 - Profilo Capelli Cliente

### 3.1 Hook Gestione Profilo

Creare file: `src/hooks/useClientHairProfile.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { HairProfile } from '@/types/hairProfile';

interface UseClientHairProfileResult {
  profile: HairProfile | null;
  loading: boolean;
  error: string | null;
  hasProfile: boolean;
  isProfileOutdated: boolean;
  saveProfile: (data: Partial<HairProfile>) => Promise<{ data?: HairProfile; error?: string }>;
  refetch: () => void;
}

/**
 * Hook per gestire il profilo capelli di un cliente
 * 
 * @param clientId - ID del cliente
 * @param shopId - ID dello shop
 */
export function useClientHairProfile(
  clientId: string | null, 
  shopId: string | null
): UseClientHairProfileResult {
  const [profile, setProfile] = useState<HairProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch profilo
  const fetchProfile = useCallback(async () => {
    if (!clientId || !shopId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('client_hair_profiles')
      .select('*')
      .eq('client_id', clientId)
      .eq('shop_id', shopId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { 
      // PGRST116 = not found, è ok
      setError(fetchError.message);
    }
    
    setProfile(data);
    setLoading(false);
  }, [clientId, shopId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Controlla se profilo è outdated (>6 mesi)
  const isProfileOutdated = (() => {
    if (!profile?.updated_at) return false;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    return new Date(profile.updated_at) < sixMonthsAgo;
  })();

  // Salva/Aggiorna profilo
  const saveProfile = async (profileData: Partial<HairProfile>) => {
    if (!clientId || !shopId) {
      return { error: 'Missing client or shop ID' };
    }

    const { data, error: saveError } = await supabase
      .from('client_hair_profiles')
      .upsert({
        client_id: clientId,
        shop_id: shopId,
        ...profileData,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'client_id,shop_id'
      })
      .select()
      .single();

    if (saveError) {
      return { error: saveError.message };
    }

    setProfile(data);
    return { data };
  };

  return {
    profile,
    loading,
    error,
    hasProfile: !!(profile?.hair_type && profile?.hair_length),
    isProfileOutdated,
    saveProfile,
    refetch: fetchProfile
  };
}
```

### 3.2 Componente Badge Profilo (Compatto)

Creare file: `src/components/client/HairProfileBadge.tsx`

```typescript
/**
 * Componente compatto per mostrare il profilo capelli
 * Usato in: calendario, modal appuntamento, liste
 * 
 * Props:
 * - profile: HairProfile | null
 * - compact?: boolean - se true mostra solo icone (default: false)
 * - showEditButton?: boolean - mostra bottone modifica (default: false)
 * - onEdit?: () => void - callback click su modifica
 * 
 * Se profile è null:
 * - Mostra "Profilo capelli non disponibile" con opzione per aggiungerlo
 * 
 * Visualizzazione normale:
 * - Icona tipo capello + label
 * - Visual lunghezza (●●○○)
 * - Badge situazione colore (se presente)
 * - Data ultimo aggiornamento (formato relativo: "2 mesi fa")
 * 
 * Visualizzazione compact:
 * - Solo icone inline: 🌊 ●●●○ 🎨
 */
```

**Implementazione suggerita:**
- Usa le costanti da `HAIR_TYPE_OPTIONS`, `HAIR_LENGTH_OPTIONS`
- Formatta data con `date-fns` o simile (es. `formatDistanceToNow`)
- Colori: sfondo leggero, bordo sottile, stile card

### 3.3 Componente Editor Profilo

Creare file: `src/components/client/HairProfileEditor.tsx`

```typescript
/**
 * Form per creare/modificare profilo capelli
 * Usato da: staff nella scheda cliente
 * 
 * Props:
 * - clientId: string
 * - shopId: string
 * - initialProfile?: HairProfile | null
 * - onSave: (profile: HairProfile) => void
 * - onCancel: () => void
 * 
 * Struttura form:
 * 1. Sezione "Tipo di capello" - radio/card selection
 * 2. Sezione "Lunghezza" - radio/card selection
 * 3. Toggle "Ha storia di colorazione"
 * 4. Se toggle ON → Sezione "Situazione colore attuale"
 * 5. Bottoni: Salva / Annulla
 * 
 * Validazione:
 * - Tipo capello: obbligatorio
 * - Lunghezza: obbligatoria
 * - Situazione colore: obbligatoria solo se toggle ON
 * 
 * UX:
 * - Mostra valori attuali se initialProfile presente
 * - Disabilita "Salva" se form non valido
 * - Feedback visivo su selezione
 */
```

### 3.4 Integrazione in Scheda Cliente

Modificare la pagina/componente scheda cliente esistente per aggiungere:

```typescript
/**
 * Nuova sezione "Profilo Capelli" nella scheda cliente
 * 
 * Posizione: dopo info contatto, prima dello storico
 * 
 * Struttura:
 * - Header: "Profilo Capelli" + bottone "Modifica" (se esiste) o "Aggiungi" (se non esiste)
 * - Body: HairProfileBadge
 * - Se click su Modifica/Aggiungi → apre Modal/Drawer con HairProfileEditor
 * 
 * Visibilità:
 * - Sempre visibile per shop_type === 'hairdresser'
 * - Nascosto per 'barbershop' e 'beauty_salon' (per ora)
 */
```

### 3.5 Integrazione in Modal Appuntamento

Modificare il modal/drawer dettaglio appuntamento nel calendario:

```typescript
/**
 * Nuova sezione nel modal appuntamento
 * 
 * Posizione: dopo info appuntamento, prima delle azioni
 * 
 * Struttura:
 * - Accordion/Collapsibile "Profilo cliente"
 * - Dentro: HairProfileBadge compact={true}
 * - Link "Modifica profilo" → apre editor
 * 
 * Visibilità:
 * - Solo se shop_type === 'hairdresser'
 * - Solo se cliente ha profilo (altrimenti mostra "Nessun profilo")
 */
```

---

## Fase 4 - Storico Visite

### 4.1 Hook Storico Visite

Creare file: `src/hooks/useClientVisitHistory.ts`

```typescript
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Gender } from '@/config/terminology';

// ==========================================
// TIPI
// ==========================================

export interface VisitHistoryItem {
  id: string;
  date: string;
  services: Array<{
    name: string;
    duration_minutes: number;
    price: number;
  }>;
  staff_name: string;
  staff_gender: Gender;
  total_duration_minutes: number;
  status: 'completed' | 'no_show' | 'cancelled';
  notes?: string | null;
}

interface UseClientVisitHistoryResult {
  history: VisitHistoryItem[];
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
}

// ==========================================
// HOOK
// ==========================================

/**
 * Hook per ottenere lo storico visite di un cliente
 * 
 * @param clientId - ID del cliente
 * @param shopId - ID dello shop
 * @param limit - Numero massimo di visite (default: 3)
 */
export function useClientVisitHistory(
  clientId: string | null, 
  shopId: string | null, 
  limit: number = 3
): UseClientVisitHistoryResult {
  const [history, setHistory] = useState<VisitHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId || !shopId) {
      setHistory([]);
      setLoading(false);
      return;
    }

    async function fetchHistory() {
      setLoading(true);
      setError(null);

      // NOTA: Adattare la query alla struttura reale del DB
      // Questa è una struttura esempio
      const { data, error: fetchError } = await supabase
        .from('appointments')
        .select(`
          id,
          start_time,
          end_time,
          status,
          notes,
          staff:shop_staff(name, gender),
          appointment_services(
            service:services(name, duration_minutes, price)
          )
        `)
        .eq('client_id', clientId)
        .eq('shop_id', shopId)
        .in('status', ['completed', 'no_show'])
        .order('start_time', { ascending: false })
        .limit(limit);

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      if (data) {
        const formatted: VisitHistoryItem[] = data.map(apt => {
          // Calcola durata totale da start/end
          const start = new Date(apt.start_time);
          const end = new Date(apt.end_time);
          const durationMs = end.getTime() - start.getTime();
          const durationMinutes = Math.round(durationMs / 60000);

          return {
            id: apt.id,
            date: apt.start_time,
            services: apt.appointment_services?.map((as: any) => ({
              name: as.service?.name || 'Servizio',
              duration_minutes: as.service?.duration_minutes || 0,
              price: as.service?.price || 0
            })) || [],
            staff_name: apt.staff?.name || 'N/A',
            staff_gender: apt.staff?.gender || 'neutral',
            total_duration_minutes: durationMinutes,
            status: apt.status,
            notes: apt.notes
          };
        });

        setHistory(formatted);
      }

      setLoading(false);
    }

    fetchHistory();
  }, [clientId, shopId, limit]);

  return { 
    history, 
    loading, 
    error,
    isEmpty: history.length === 0
  };
}
```

### 4.2 Componente Lista Storico

Creare file: `src/components/client/ClientVisitHistory.tsx`

```typescript
/**
 * Componente per mostrare lo storico visite
 * 
 * Props:
 * - clientId: string
 * - shopId: string
 * - limit?: number (default: 3)
 * 
 * Visualizzazione per ogni visita:
 * - Data formattata (es. "15 Gennaio 2025")
 * - Lista servizi effettuati
 * - Nome staff (con genere corretto dal dizionario)
 * - Durata totale
 * - Badge stato: ✓ Completato | ✗ No-show
 * - Note (se presenti, troncate con "...")
 * 
 * Stati:
 * - Loading: skeleton/spinner
 * - Empty: "Nessuna visita precedente"
 * - Error: messaggio errore con retry
 * 
 * Stile:
 * - Lista verticale con card
 * - Separatore tra visite
 * - Colori diversi per stato (verde completato, rosso no-show)
 */
```

### 4.3 Integrazione

**In Scheda Cliente:**
- Aggiungere `ClientVisitHistory` sotto la sezione "Profilo Capelli"
- Header: "Ultime visite"

**In Modal Appuntamento:**
- Aggiungere sezione collassabile "Storico cliente"
- Dentro: `ClientVisitHistory` con `limit={3}`

---

## Fase 5 - Questionario e Calcolo Durata

### 5.1 Utility Calcolo Durata

Creare file: `src/utils/calculateDuration.ts`

```typescript
import { 
  HairProfile, 
  HairType, 
  HairLength, 
  ColorSituation,
  DurationConfig, 
  DurationResult 
} from '@/types/hairProfile';

// ==========================================
// CONFIG DEFAULT
// ==========================================

export const DEFAULT_DURATION_CONFIG: DurationConfig = {
  base_minutes: 30,
  hair_type_multipliers: {
    straight_fine: 1.0,
    wavy_medium: 1.15,
    curly_thick: 1.25,
    very_curly_afro: 1.4
  },
  hair_length_multipliers: {
    short: 1.0,
    medium: 1.2,
    long: 1.35,
    very_long: 1.5
  },
  color_situation_extra_minutes: {
    virgin: 0,
    roots_touch_up: 0,
    full_color_change: 30,
    color_correction: 60
  },
  buffer_percentage: 10
};

// ==========================================
// HELPER FORMATTAZIONE
// ==========================================

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
}

// ==========================================
// CALCOLO PRINCIPALE
// ==========================================

interface ServiceWithConfig {
  id: string;
  name: string;
  duration_minutes: number;
  is_duration_variable: boolean;
  duration_config?: DurationConfig;
}

/**
 * Calcola la durata stimata per un insieme di servizi
 * basandosi sul profilo capelli del cliente
 */
export function calculateServiceDuration(
  services: ServiceWithConfig[],
  hairProfile: Partial<HairProfile>
): DurationResult {
  let totalMinutes = 0;
  let baseTotal = 0;
  let afterHairType = 0;
  let afterLength = 0;
  let colorExtra = 0;

  for (const service of services) {
    // Servizio a durata fissa
    if (!service.is_duration_variable) {
      totalMinutes += service.duration_minutes;
      baseTotal += service.duration_minutes;
      afterHairType += service.duration_minutes;
      afterLength += service.duration_minutes;
      continue;
    }

    // Servizio a durata variabile
    const config = service.duration_config || DEFAULT_DURATION_CONFIG;
    let minutes = config.base_minutes;
    baseTotal += config.base_minutes;

    // Moltiplicatore tipo capello
    if (hairProfile.hair_type) {
      const multiplier = config.hair_type_multipliers[hairProfile.hair_type] || 1;
      minutes *= multiplier;
    }
    afterHairType += minutes;

    // Moltiplicatore lunghezza
    if (hairProfile.hair_length) {
      const multiplier = config.hair_length_multipliers[hairProfile.hair_length] || 1;
      minutes *= multiplier;
    }
    afterLength += minutes;

    // Extra colore
    if (hairProfile.color_situation && config.color_situation_extra_minutes) {
      const extra = config.color_situation_extra_minutes[hairProfile.color_situation] || 0;
      minutes += extra;
      colorExtra += extra;
    }

    totalMinutes += minutes;
  }

  // Buffer sicurezza (10%)
  const buffer = totalMinutes * 0.1;
  totalMinutes += buffer;

  // Arrotonda a slot di 15 minuti (per eccesso)
  const roundedMinutes = Math.ceil(totalMinutes / 15) * 15;

  return {
    estimated_minutes: Math.round(totalMinutes),
    rounded_minutes: roundedMinutes,
    breakdown: {
      base: Math.round(baseTotal),
      after_hair_type: Math.round(afterHairType),
      after_length: Math.round(afterLength),
      color_extra: Math.round(colorExtra),
      buffer: Math.round(buffer),
      final: roundedMinutes
    },
    display: formatDuration(roundedMinutes)
  };
}
```

### 5.2 Hook Logica Questionario

Creare file: `src/hooks/useHairQuestionnaire.ts`

```typescript
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { HairProfile } from '@/types/hairProfile';
import { useClientHairProfile } from './useClientHairProfile';

// ==========================================
// TIPI
// ==========================================

export type QuestionType = 'hair_type' | 'hair_length' | 'color_situation';

export interface QuestionnaireDecision {
  shouldShow: boolean;
  reason: 'disabled' | 'no_variable_services' | 'no_profile' | 'profile_outdated' | 'needs_color_info' | 'skip';
  existingProfile: HairProfile | null;
  questionsToAsk: QuestionType[];
}

interface Service {
  id: string;
  name: string;
  is_duration_variable: boolean;
}

// ==========================================
// HOOK
// ==========================================

/**
 * Hook che decide se mostrare il questionario e quali domande fare
 */
export function useHairQuestionnaire(
  shopId: string | null,
  clientId: string | null,
  selectedServices: Service[]
): QuestionnaireDecision | null {
  const [decision, setDecision] = useState<QuestionnaireDecision | null>(null);
  const { profile, hasProfile, isProfileOutdated } = useClientHairProfile(clientId, shopId);

  useEffect(() => {
    async function checkQuestionnaire() {
      if (!shopId) {
        setDecision({ shouldShow: false, reason: 'disabled', existingProfile: null, questionsToAsk: [] });
        return;
      }

      // 1. Shop ha abilitato il questionario?
      const { data: shop } = await supabase
        .from('shops')
        .select('hair_questionnaire_enabled, shop_type')
        .eq('id', shopId)
        .single();

      if (!shop?.hair_questionnaire_enabled || shop.shop_type !== 'hairdresser') {
        setDecision({ shouldShow: false, reason: 'disabled', existingProfile: null, questionsToAsk: [] });
        return;
      }

      // 2. Servizi selezionati richiedono durata variabile?
      const hasVariableServices = selectedServices.some(s => s.is_duration_variable);
      if (!hasVariableServices) {
        setDecision({ shouldShow: false, reason: 'no_variable_services', existingProfile: profile, questionsToAsk: [] });
        return;
      }

      // 3. Determina quali domande fare
      const questionsToAsk: QuestionType[] = [];

      // Nessun profilo → domande base
      if (!hasProfile) {
        questionsToAsk.push('hair_type', 'hair_length');
      } 
      // Profilo outdated → conferma
      else if (isProfileOutdated) {
        questionsToAsk.push('hair_type', 'hair_length');
      }

      // 4. Servizi colore richiedono info aggiuntive
      const isColorService = selectedServices.some(s => {
        const name = s.name.toLowerCase();
        return name.includes('colore') || 
               name.includes('tinta') || 
               name.includes('meches') || 
               name.includes('balayage') ||
               name.includes('shatush');
      });

      if (isColorService) {
        questionsToAsk.push('color_situation');
      }

      // 5. Determina reason
      let reason: QuestionnaireDecision['reason'] = 'skip';
      if (!hasProfile) reason = 'no_profile';
      else if (isProfileOutdated) reason = 'profile_outdated';
      else if (questionsToAsk.length > 0) reason = 'needs_color_info';

      setDecision({
        shouldShow: questionsToAsk.length > 0,
        reason,
        existingProfile: profile,
        questionsToAsk
      });
    }

    checkQuestionnaire();
  }, [shopId, clientId, selectedServices, profile, hasProfile, isProfileOutdated]);

  return decision;
}
```

### 5.3 Componente Questionario

Creare file: `src/components/booking/HairQuestionnaire.tsx`

```typescript
/**
 * Modal/Overlay con questionario step-by-step
 * 
 * Props:
 * - existingProfile?: HairProfile | null
 * - questionsToAsk: QuestionType[]
 * - onComplete: (profile: Partial<HairProfile>) => void
 * 
 * Struttura:
 * - Header con titolo e progress bar
 * - Content area con domanda corrente (animata)
 * - Footer con info (se profilo esistente)
 * 
 * Step possibili:
 * 1. hair_type: griglia 2x2 con opzioni tipo capello
 * 2. hair_length: lista verticale con visual (●●○○)
 * 3. color_situation: lista verticale opzioni colore
 * 
 * Comportamento:
 * - Auto-advance dopo selezione (300ms delay)
 * - Progress bar animata
 * - Transizioni smooth tra step
 * - Se esistingProfile presente, mostra "Conferma o modifica"
 * 
 * UX:
 * - Max 60 secondi per completare
 * - Opzioni con icone grandi per tap facile
 * - Non mostrare bottone "Salta" (è obbligatorio)
 */
```

### 5.4 Componente Risultato Stima

Creare file: `src/components/booking/DurationEstimate.tsx`

```typescript
/**
 * Card che mostra il risultato del calcolo durata
 * 
 * Props:
 * - result: DurationResult
 * - onAccept: (minutes: number) => void
 * - onModifyProfile: () => void
 * 
 * Visualizzazione:
 * - Icona orologio grande
 * - "Tempo consigliato per te"
 * - Durata grande (es. "2h 30min") in colore primario
 * - Sottotitolo: "Basato sul tuo tipo di capello"
 * 
 * Breakdown (collapsibile):
 * - Tempo base: X min
 * - Adattamento tipo capello: +X min
 * - Adattamento lunghezza: +X min
 * - Extra colore: +X min (se applicabile)
 * - Buffer sicurezza: +X min
 * - Totale: X min
 * 
 * Azioni:
 * - Bottone primario: "Prenota con questa durata"
 * - Link secondario: "I miei capelli sono cambiati" → riapre questionario
 * 
 * Stile:
 * - Card con sfondo gradient leggero (verde/emerald)
 * - Bordo colorato
 * - Animazione fade-in
 */
```

### 5.5 Toggle Impostazioni Shop

Aggiungere nelle impostazioni shop (solo per `hairdresser`):

```typescript
/**
 * Nuova sezione nelle impostazioni shop
 * 
 * Visibilità: solo se shop_type === 'hairdresser'
 * 
 * Contenuto:
 * - Titolo: "Questionario Stima Durata"
 * - Toggle ON/OFF
 * - Descrizione quando OFF: "Attiva per chiedere ai clienti informazioni sui loro capelli e calcolare automaticamente la durata corretta degli appuntamenti"
 * - Descrizione quando ON: "I clienti risponderanno a 2-3 domande veloci durante la prenotazione. I dati vengono salvati per le visite successive."
 * 
 * Comportamento:
 * - Toggle salva immediatamente su DB (hair_questionnaire_enabled)
 * - Toast di conferma
 */
```

---

## Fase 6 - Integrazione Booking

### 6.1 Flusso Modificato

```
FLUSSO BOOKING CLIENTE (con questionario attivo)

1. Selezione servizi
   └─ Cliente seleziona uno o più servizi
   
2. Check questionario
   └─ useHairQuestionnaire determina se mostrare
   
3. [SE shouldShow === true]
   └─ Mostra HairQuestionnaire
   └─ Cliente risponde (max 3 domande)
   └─ Salva profilo in DB
   
4. Calcolo durata
   └─ calculateServiceDuration(services, profile)
   └─ Mostra DurationEstimate
   
5. [SE cliente accetta]
   └─ Procedi con durata calcolata
   
6. [SE "I miei capelli sono cambiati"]
   └─ Torna a step 3

7. Selezione slot
   └─ Mostra calendario con slot di durata corretta
   
8. Conferma
   └─ Crea appuntamento con durata calcolata
```

### 6.2 Modifiche al Componente Booking

```typescript
/**
 * Modifiche da apportare al flusso di booking esistente
 * 
 * 1. Importare hooks e componenti:
 *    - useHairQuestionnaire
 *    - useClientHairProfile
 *    - calculateServiceDuration
 *    - HairQuestionnaire
 *    - DurationEstimate
 * 
 * 2. Aggiungere stato:
 *    - showQuestionnaire: boolean
 *    - hairProfile: Partial<HairProfile>
 *    - estimatedDuration: DurationResult | null
 * 
 * 3. Dopo selezione servizi:
 *    - Chiamare useHairQuestionnaire
 *    - Se shouldShow → mostrare HairQuestionnaire
 * 
 * 4. Dopo completamento questionario:
 *    - Salvare profilo
 *    - Calcolare durata
 *    - Mostrare DurationEstimate
 * 
 * 5. Dopo accettazione durata:
 *    - Usare rounded_minutes per cercare slot disponibili
 *    - Passare durata a creazione appuntamento
 * 
 * 6. Se questionario non necessario:
 *    - Usare durata standard del servizio
 *    - Saltare direttamente a selezione slot
 */
```

---

## Checklist Implementazione

### Database
- [ ] Creare tabella `client_hair_profiles`
- [ ] Aggiungere `hair_questionnaire_enabled` a `shops`
- [ ] Aggiungere `is_duration_variable` a `services`
- [ ] Aggiungere `duration_config` a `services`
- [ ] Creare indici
- [ ] Creare RLS policies
- [ ] Testare query

### Tipi e Costanti
- [ ] Creare file `src/types/hairProfile.ts`
- [ ] Definire tutti i tipi
- [ ] Definire opzioni per UI
- [ ] Creare helper per labels

### Profilo Capelli
- [ ] Creare hook `useClientHairProfile`
- [ ] Creare componente `HairProfileBadge`
- [ ] Creare componente `HairProfileEditor`
- [ ] Integrare in scheda cliente
- [ ] Integrare in modal appuntamento
- [ ] Testare salvataggio/modifica

### Storico Visite
- [ ] Creare hook `useClientVisitHistory`
- [ ] Creare componente `ClientVisitHistory`
- [ ] Integrare in scheda cliente
- [ ] Integrare in modal appuntamento
- [ ] Testare con dati reali

### Questionario
- [ ] Creare utility `calculateDuration`
- [ ] Creare hook `useHairQuestionnaire`
- [ ] Creare componente `HairQuestionnaire`
- [ ] Creare componente `DurationEstimate`
- [ ] Aggiungere toggle in impostazioni shop
- [ ] Testare calcolo durata

### Integrazione Booking
- [ ] Modificare flusso booking
- [ ] Integrare questionario
- [ ] Integrare calcolo durata
- [ ] Testare flusso completo
- [ ] Testare con questionario OFF
- [ ] Testare con profilo esistente
- [ ] Testare con profilo outdated

### Test End-to-End
- [ ] Nuovo cliente senza profilo
- [ ] Cliente con profilo recente
- [ ] Cliente con profilo >6 mesi
- [ ] Servizi solo fissi (no questionario)
- [ ] Servizi variabili (con questionario)
- [ ] Servizi colore (domanda extra)
- [ ] Staff modifica profilo cliente
- [ ] Visualizzazione storico visite

---

## Note per lo Sviluppatore

1. **Solo per hairdresser** - Nascondere completamente questionario e profilo capelli per `barbershop` e `beauty_salon`

2. **Profilo per shop** - Ogni shop ha il suo profilo per la cliente, non è condiviso

3. **Durata solo stimata** - Non tracciare durata reale per ora

4. **6 mesi = outdated** - Dopo 6 mesi il sistema chiede conferma del profilo

5. **Buffer 10%** - Sempre aggiunto per sicurezza

6. **Arrotondamento** - Sempre a multipli di 15 minuti, per eccesso

7. **Servizi colore** - Rilevati da nome (colore, tinta, meches, balayage, shatush)

8. **Salvataggio auto** - Il profilo si salva automaticamente dopo il questionario

9. **Query adattamento** - Le query Supabase vanno adattate alla struttura reale del DB (nomi tabelle, relazioni)

---

## FAQ

**D: Il questionario blocca la prenotazione?**
R: Sì, se attivo è obbligatorio per procedere con servizi a durata variabile.

**D: Quanto dura il profilo?**
R: Non scade mai, ma dopo 6 mesi chiede conferma rapida.

**D: E se il cliente mente sul questionario?**
R: Il parrucchiere può sempre modificare il profilo dalla scheda cliente.

**D: La durata calcolata è modificabile?**
R: Il cliente vede la durata consigliata e può dire "i miei capelli sono cambiati" per rifare il questionario. Non può inserire una durata arbitraria.

**D: E per servizi non variabili?**
R: Usano la durata fissa impostata nel servizio, nessun questionario.