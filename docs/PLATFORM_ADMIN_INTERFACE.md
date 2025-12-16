# Piattaforma di Gestione Negozi e Admin - Specifiche di Implementazione

## 📋 Contesto del Progetto

**Poltrona** è un sistema SaaS multi-tenant per la gestione di appuntamenti per barberie/negozi. Ogni negozio ha il proprio spazio isolato nel database, gestito tramite `shop_id` e Row Level Security (RLS) di Supabase.

### Architettura Multi-Tenant

- **Database condiviso**: Un unico database PostgreSQL su Supabase
- **Isolamento dati**: Ogni negozio vede solo i propri dati tramite `shop_id`
- **RLS (Row Level Security)**: Policy PostgreSQL che filtrano automaticamente i dati per `shop_id`
- **Platform Admin**: Utente speciale con `is_platform_admin = true` che può vedere e gestire TUTTI i negozi

## 🎯 Obiettivo

Creare una **piattaforma di gestione** accessibile solo ai Platform Admin per:
1. **Visualizzare tutti i negozi** nel sistema
2. **Creare nuovi negozi** e relativi admin
3. **Gestire admin esistenti** (creare, modificare, disabilitare)
4. **Visualizzare statistiche** globali (numero negozi, utenti totali, ecc.)
5. **Gestire shop_invites** (token per setup nuovi negozi)

## 🏗️ Architettura Attuale

### Stack Tecnologico

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Autenticazione**: Supabase Auth
- **Storage**: Supabase Storage (per logo negozi)

### Struttura Progetto

```
src/
├── components/          # Componenti React
│   ├── ui/             # Componenti UI riutilizzabili (Button, Card, Input, etc.)
│   ├── Shop.tsx        # Gestione negozio (per admin negozio)
│   ├── ShopSetup.tsx   # Setup wizard per nuovi negozi
│   └── ...
├── contexts/           # React Context
│   ├── AuthContext.tsx # Gestione autenticazione (include isPlatformAdmin())
│   ├── ShopContext.tsx # Gestione shop corrente
│   └── ...
├── services/
│   └── api.ts          # API service per chiamate Supabase
├── types/
│   ├── auth.ts         # Tipi User, AuthState (include is_platform_admin)
│   └── index.ts        # Altri tipi (Shop, Profile, etc.)
└── config/
    └── api.ts          # Configurazione API endpoints
```

### Routing Attuale

L'app usa un sistema di **tab-based navigation** (non React Router):

```typescript
// src/App.tsx
const [activeTab, setActiveTab] = useState('dashboard');

// Tab disponibili:
- 'dashboard'      // Dashboard principale
- 'calendar'       // Calendario appuntamenti
- 'clients'        // Gestione clienti
- 'services'       // Servizi
- 'products'       // Prodotti
- 'shop'           // Impostazioni negozio
- 'settings'       // Opzioni
- 'client_booking' // Prenotazione (per clienti)
// ... etc
```

## 📊 Database Schema

### Tabelle Principali

#### `profiles`
```sql
- user_id (UUID, PK) → auth.users.id
- shop_id (UUID, nullable) → shops.id
- role (TEXT) → 'admin', 'barber', 'client'
- full_name (TEXT, nullable)
- is_platform_admin (BOOLEAN) → true solo per Platform Admin
- created_at (TIMESTAMP)
```

#### `shops`
```sql
- id (UUID, PK)
- name (TEXT)
- slug (TEXT, unique) → URL-friendly identifier
- address, postal_code, city, province (TEXT, nullable)
- phone, whatsapp, email, notification_email (TEXT, nullable)
- description (TEXT, nullable)
- logo_url, logo_path (TEXT, nullable)
- theme_palette (TEXT, nullable)
- created_at (TIMESTAMP)
```

#### `shop_invites`
```sql
- id (UUID, PK)
- token (TEXT, unique) → Token per setup nuovo negozio
- admin_user_id (UUID, nullable) → auth.users.id dell'admin associato
- created_by (TEXT, nullable)
- created_at (TIMESTAMP)
- used_at (TIMESTAMP, nullable)
- used_by_shop_id (UUID, nullable) → shops.id se già usato
- expires_at (TIMESTAMP, nullable)
```

### Funzioni Database

#### `public.is_platform_admin(user_id_param UUID DEFAULT auth.uid())`
Verifica se un utente è Platform Admin.

#### `public.current_shop_id()`
Restituisce lo `shop_id` dell'utente corrente dal profilo.

## 🔐 Autenticazione e Permessi

### AuthContext

```typescript
// src/contexts/AuthContext.tsx
const { user, isPlatformAdmin, hasPermission } = useAuth();

// user.is_platform_admin → boolean
// isPlatformAdmin() → boolean (helper function)
```

### Verifica Platform Admin

```typescript
import { useAuth } from '../contexts/AuthContext';

const MyComponent = () => {
  const { isPlatformAdmin } = useAuth();
  
  if (!isPlatformAdmin()) {
    return <div>Accesso negato</div>;
  }
  
  // Mostra interfaccia Platform Admin
};
```

## 🛠️ API Service

### Metodi Esistenti in `apiService`

```typescript
// src/services/api.ts

// Shops
apiService.getShop()                    // Shop corrente (filtrato per shop_id)
apiService.getShopBySlug(slug)          // Shop per slug
apiService.createShop(data)             // Crea nuovo shop
apiService.updateShop(id, data)         // Aggiorna shop

// Profiles/Users
apiService.getProfile(userId)           // Profilo utente
apiService.updateProfile(userId, data) // Aggiorna profilo

// Shop Invites
apiService.validateShopInvite(token)    // Valida token invito
apiService.markShopInviteUsed(token, shopId) // Marca token come usato
```

### Endpoint Supabase

```typescript
// src/config/api.ts
API_ENDPOINTS = {
  SHOPS: '/rest/v1/shops',
  PROFILES: '/rest/v1/profiles',
  SHOP_INVITES: '/rest/v1/shop_invites',
  // ... altri
}
```

## 🎨 Componenti UI Disponibili

### Componenti Base (`src/components/ui/`)

- **Button**: `<Button variant="primary" onClick={...}>Testo</Button>`
- **Card**: `<Card className="...">Contenuto</Card>`
- **Input**: `<Input label="..." value={...} onChange={...} />`
- **Modal**: `<Modal isOpen={...} onClose={...}>...</Modal>`
- **Select**: `<Select options={...} value={...} onChange={...} />`
- **Toast**: Usa `useToast()` hook

### Esempio di Utilizzo

```typescript
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useToast } from '../hooks/useToast';

const MyComponent = () => {
  const { toast, showToast } = useToast();
  
  return (
    <Card className="p-6">
      <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} />
      <Button onClick={() => showToast('Salvato!', 'success')}>
        Salva
      </Button>
    </Card>
  );
};
```

## 📝 Requisiti Implementazione

### 1. Nuovo Tab "Platform Admin"

**File**: `src/components/PlatformAdmin.tsx`

**Accesso**: Solo se `isPlatformAdmin() === true`

**Funzionalità**:
- Lista di tutti i negozi (tabella con paginazione)
- Filtri: per nome, slug, data creazione
- Statistiche globali (card in alto):
  - Totale negozi
  - Totale utenti
  - Totale admin
  - Negozi attivi (con appuntamenti recenti)

### 2. Gestione Negozi

**Sezione**: "Gestione Negozi"

**Azioni**:
- **Visualizza dettagli negozio**: Click su riga → modal con dettagli completi
- **Crea nuovo negozio**: Bottone "Crea Negozio" → form wizard
- **Modifica negozio**: Edit inline o modal
- **Elimina negozio**: Con conferma (cascading delete su dati correlati)

**Form Creazione Negozio**:
```typescript
interface CreateShopForm {
  name: string;
  slug: string; // autogenerato da name
  address?: string;
  postal_code?: string;
  city?: string;
  province?: string;
  phone?: string;
  email?: string;
  notification_email?: string;
  description?: string;
  theme_palette?: string;
}
```

### 3. Gestione Admin

**Sezione**: "Gestione Admin"

**Funzionalità**:
- Lista tutti gli admin (filtro per `role = 'admin'`)
- Crea nuovo admin:
  - Email
  - Password
  - Nome completo
  - Shop associato (select da lista negozi)
  - Flag `is_platform_admin` (solo per Platform Admin)
- Modifica admin esistente
- Disabilita/Abilita admin (campo `active` o simile)
- Reset password admin

**Form Creazione Admin**:
```typescript
interface CreateAdminForm {
  email: string;
  password: string;
  full_name: string;
  shop_id: string | null; // null = Platform Admin senza negozio
  is_platform_admin: boolean; // solo se crei Platform Admin
}
```

### 4. Gestione Shop Invites

**Sezione**: "Token di Invito"

**Funzionalità**:
- Lista tutti i token (usati e non usati)
- Crea nuovo token:
  - Genera token randomico univoco
  - Associa `admin_user_id` (select da lista admin)
  - Imposta `expires_at` (opzionale, default 30 giorni)
- Revoca token (elimina o marca come scaduto)
- Visualizza dettagli token (quando usato, da chi, per quale shop)

**Form Creazione Token**:
```typescript
interface CreateInviteForm {
  admin_user_id: string; // Admin che userà il token
  expires_at?: string; // ISO date, opzionale
}
```

### 5. Statistiche e Dashboard

**Sezione**: Dashboard principale

**Metriche**:
- Totale negozi (con trend ultimi 30 giorni)
- Totale utenti (admin + barber + client)
- Totale appuntamenti (ultimi 30 giorni)
- Negozi più attivi (top 5 per numero appuntamenti)
- Grafici (opzionale, con Chart.js o simile):
  - Negozi creati nel tempo
  - Utenti registrati nel tempo

## 🔧 Implementazione Tecnica

### 1. Aggiungere Tab alla Navigation

**File**: `src/components/Navigation.tsx`

```typescript
// Aggiungi alla lista navItems (solo se Platform Admin)
const { isPlatformAdmin } = useAuth();

const platformAdminNavItem = isPlatformAdmin() 
  ? { id: 'platform_admin', label: 'Platform Admin', icon: Shield, permission: 'platform_admin' }
  : null;
```

**File**: `src/App.tsx`

```typescript
// Aggiungi al renderActiveTab()
case 'platform_admin':
  return <PlatformAdmin />;
```

### 2. Nuovi Metodi API

**File**: `src/services/api.ts`

Aggiungi metodi per Platform Admin (bypassano RLS tramite `is_platform_admin`):

```typescript
// Ottieni tutti i negozi (solo Platform Admin)
async getAllShops(): Promise<Shop[]> {
  // Query: SELECT * FROM shops ORDER BY created_at DESC
  // RLS permetterà se is_platform_admin() = true
}

// Ottieni tutti gli admin
async getAllAdmins(): Promise<Profile[]> {
  // Query: SELECT * FROM profiles WHERE role = 'admin'
}

// Crea nuovo admin
async createAdmin(data: CreateAdminForm): Promise<Profile> {
  // 1. Crea utente in Supabase Auth (POST /auth/v1/signup)
  // 2. Aggiorna profilo con role='admin', shop_id, is_platform_admin
}

// Crea nuovo shop invite
async createShopInvite(data: CreateInviteForm): Promise<ShopInvite> {
  // Genera token randomico, inserisci in shop_invites
}
```

### 3. Componente Principale

**File**: `src/components/PlatformAdmin.tsx`

```typescript
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
// ... altri import

export const PlatformAdmin: React.FC = () => {
  const { isPlatformAdmin } = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [admins, setAdmins] = useState<Profile[]>([]);
  const [activeSection, setActiveSection] = useState<'shops' | 'admins' | 'invites' | 'stats'>('stats');

  // Verifica permessi
  if (!isPlatformAdmin()) {
    return <div>Accesso negato. Solo Platform Admin può accedere.</div>;
  }

  // Carica dati
  useEffect(() => {
    loadAllShops();
    loadAllAdmins();
  }, []);

  // Render sezioni
  return (
    <div className="p-6 space-y-6">
      {/* Tabs per sezioni */}
      {/* Statistiche */}
      {/* Gestione Negozi */}
      {/* Gestione Admin */}
      {/* Gestione Invites */}
    </div>
  );
};
```

### 4. Styling

Usa **Tailwind CSS** con lo stesso stile dell'app esistente:

- **Card**: `bg-white rounded-lg shadow p-6`
- **Button**: `bg-[#1e40af] text-white px-4 py-2 rounded`
- **Table**: `w-full border-collapse`
- **Input**: Componente `Input` esistente

Colori brand:
- Blu scuro: `#1e40af`
- Verde: `#10b981`
- Azzurro: `#3b82f6`

## 📋 Checklist Implementazione

- [ ] Creare componente `PlatformAdmin.tsx`
- [ ] Aggiungere tab "Platform Admin" alla Navigation (solo se Platform Admin)
- [ ] Aggiungere case in `App.tsx` per renderizzare componente
- [ ] Implementare metodi API:
  - [ ] `getAllShops()`
  - [ ] `getAllAdmins()`
  - [ ] `createAdmin()`
  - [ ] `createShopInvite()`
  - [ ] `getAllShopInvites()`
- [ ] Implementare sezione Statistiche
- [ ] Implementare sezione Gestione Negozi (lista, crea, modifica, elimina)
- [ ] Implementare sezione Gestione Admin (lista, crea, modifica)
- [ ] Implementare sezione Gestione Shop Invites (lista, crea, revoca)
- [ ] Aggiungere validazione form
- [ ] Aggiungere gestione errori e toast notifications
- [ ] Testare con account Platform Admin
- [ ] Verificare che utenti normali non possano accedere

## 🧪 Testing

### Test Manuali

1. **Login come Platform Admin**
   - Verifica che tab "Platform Admin" appaia nella navigation
   - Verifica accesso al componente

2. **Login come Admin normale**
   - Verifica che tab "Platform Admin" NON appaia
   - Verifica che accesso diretto venga negato

3. **Funzionalità**
   - Crea nuovo negozio → verifica che appaia in lista
   - Crea nuovo admin → verifica che possa fare login
   - Crea shop invite → verifica che token funzioni in ShopSetup

## 📚 Riferimenti

- **Shop Setup**: `src/components/ShopSetup.tsx` (esempio di form multi-step)
- **Shop Management**: `src/components/Shop.tsx` (esempio di gestione negozio)
- **API Service**: `src/services/api.ts` (esempi di chiamate Supabase)
- **Auth Context**: `src/contexts/AuthContext.tsx` (verifica permessi)
- **SQL Scripts**: `sql/add_platform_admin_support.sql` (setup Platform Admin)

## 🚀 Note Finali

- **Sicurezza**: Tutte le query devono rispettare RLS. Il Platform Admin bypassa RLS tramite la funzione `is_platform_admin()` nelle policy.
- **Performance**: Per liste grandi, implementa paginazione (es. 50 items per pagina)
- **UX**: Usa loading states, error handling, e feedback visivo (toast) per tutte le operazioni
- **Responsive**: Assicurati che l'interfaccia sia responsive (mobile-friendly)

---

**Buon lavoro!** 🎉


