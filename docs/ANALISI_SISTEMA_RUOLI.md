# Analisi Completa Sistema Ruoli

## Problema Identificato

Il ruolo "barber" viene visualizzato come "client" o "admin" perché:
1. **0 profili** hanno `role='barber'` nel database
2. **4 staff** hanno `user_id` collegati
3. **4 profili** hanno `role='admin'` (probabilmente i 4 staff)

## Architettura del Sistema Ruoli

### 1. Definizioni Ruoli

#### TypeScript (`src/types/auth.ts`)
```typescript
export type UserRole = 'admin' | 'barber' | 'client';
```

#### Database (`sql/setup_database.sql`)
Il constraint permette:
- `'admin'`, `'manager'`, `'staff'`, `'user'`, `'client'`, `'barber'`, `'receptionist'`, `'owner'`

**Discrepanza**: Il database permette più ruoli di quelli definiti in TypeScript.

### 2. Tabelle Coinvolte

#### `profiles` (tabella principale per ruoli utente)
- `user_id` (PK, FK → auth.users)
- `role` (TEXT, constraint: admin|manager|staff|user|client|barber|receptionist|owner)
- `shop_id` (FK → shops)
- `full_name`
- `is_platform_admin`

#### `staff` (tabella per membri dello staff)
- `id` (PK)
- `user_id` (FK → auth.users, nullable) - **Collegamento a utente**
- `role` (TEXT, nullable) - **Ruolo del barbiere** (es: "Barber", "Master Barber")
- `shop_id` (FK → shops)
- `full_name`
- `active`

**IMPORTANTE**: 
- `profiles.role` = ruolo dell'utente nel sistema (admin/barber/client)
- `staff.role` = ruolo del barbiere (es: "Barber", "Master Barber") - **DIVERSO**

### 3. Flusso di Autenticazione

#### A. Login (`src/contexts/AuthContext.tsx:469-598`)

1. **Autenticazione** (linea 479-488)
   - Richiesta token a Supabase Auth
   - Ottiene `access_token` e `user.id`

2. **Caricamento Profilo** (linea 552-570)
   ```typescript
   const profileRes = await fetch(`${API_ENDPOINTS.PROFILES}?select=*&user_id=eq.${authUserId}`, ...);
   const profile = profiles[0];
   ```

3. **Costruzione User Object** (linea 573-581)
   ```typescript
   const user: User = {
     id: authUserId,
     email: credentials.email,
     full_name: (profile as any).full_name ?? '',
     role: (profile as any).role ?? 'client',  // ⚠️ Fallback a 'client'
     shop_id: shopId,
     is_platform_admin: (profile as any).is_platform_admin ?? false,
     created_at: new Date().toISOString(),
   };
   ```

4. **Salvataggio in Storage** (linea 586)
   ```typescript
   saveAuthData(user, accessToken, tokenJson.refresh_token, rememberMe);
   // Salva in localStorage o sessionStorage
   ```

#### B. Caricamento Iniziale App (`src/contexts/AuthContext.tsx:363-467`)

1. **Caricamento da Storage** (linea 366)
   ```typescript
   const { user, accessToken, refreshToken, rememberMe } = loadAuthData();
   // Legge da localStorage o sessionStorage
   ```

2. **Verifica Token** (linea 371)
   - Verifica se il token è valido
   - **NON ricarica il ruolo dal database**

3. **Impostazione Stato** (linea 375-379)
   ```typescript
   setAuthState({
     user,  // ⚠️ Usa il ruolo salvato in localStorage, NON dal database
     isAuthenticated: true,
     isLoading: false,
   });
   ```

**PROBLEMA CRITICO**: Se il ruolo cambia nel database, l'utente deve fare logout/login per vedere il cambiamento.

#### C. OAuth Callback (`src/contexts/AuthContext.tsx:135-361`)

1. **Caricamento Profilo** (linea 181-191)
   ```typescript
   const profileRes = await fetch(`${API_ENDPOINTS.PROFILES}?select=*&user_id=eq.${authUserId}`, ...);
   profile = profiles[0];
   ```

2. **Creazione Profilo Se Non Esiste** (linea 211-251)
   ```typescript
   if (!profile) {
     // ⚠️ Crea SEMPRE con role='client'
     body: JSON.stringify({
       user_id: authUserId,
       full_name: fullName,
       role: 'client',  // ⚠️ SEMPRE 'client'
       shop_id: resolvedShopId,
       is_platform_admin: false,
     })
   }
   ```

3. **Costruzione User Object** (linea 314-322)
   ```typescript
   const user: User = {
     id: authUserId,
     email: userEmail,
     full_name: profile?.full_name || fullName,
     role: (profile?.role as UserRole) || 'client',  // ⚠️ Fallback a 'client'
     shop_id: profile?.shop_id || resolvedShopId,
     is_platform_admin: profile?.is_platform_admin || false,
     created_at: profile?.created_at || new Date().toISOString(),
   };
   ```

#### D. Refresh Session (`src/contexts/AuthContext.tsx:610-651`)

```typescript
const refreshSession = async (): Promise<boolean> => {
  // ⚠️ Aggiorna SOLO il token, NON ricarica il ruolo dal database
  // Usa il ruolo salvato in localStorage
}
```

**PROBLEMA**: Il refresh del token non aggiorna il ruolo dal database.

### 4. Gestione Staff e Collegamento a Utenti

#### Creazione Staff (`src/services/api.ts:3120-3193`)

```typescript
async createStaff(staffData: Omit<Staff, 'id' | 'created_at'>): Promise<Staff> {
  // Crea record in tabella staff
  // ⚠️ NON aggiorna profiles.role a 'barber' quando si collega un user_id
}
```

#### Aggiornamento Staff (`src/services/api.ts:3196-3232`)

```typescript
async updateStaff(id: string, staffData: Partial<Staff>): Promise<Staff> {
  // Aggiorna record in tabella staff
  // ⚠️ NON aggiorna profiles.role a 'barber' quando si aggiunge/modifica user_id
}
```

**PROBLEMA CRITICO**: Quando si crea/aggiorna uno staff con `user_id`, il sistema NON aggiorna `profiles.role` a `'barber'`.

### 5. Trigger SQL

#### `handle_new_user()` (`sql/setup_database.sql:68-123`)

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
-- ⚠️ Crea SEMPRE profilo con role='client'
INSERT INTO public.profiles (user_id, shop_id, role, full_name, created_at)
VALUES (NEW.id, v_resolved_shop_id, 'client', ...);
```

#### `auto_create_staff_for_barber()` (`sql/auto_link_staff_user.sql:18-51`)

```sql
CREATE OR REPLACE FUNCTION public.auto_create_staff_for_barber()
-- Crea staff quando profiles.role IN ('barber', 'admin', 'staff', 'owner')
-- ⚠️ Funziona solo in una direzione: profile → staff
-- NON aggiorna profile.role quando si crea staff con user_id
```

**PROBLEMA**: Il trigger funziona solo in una direzione (profile → staff), non viceversa.

### 6. Verifica Permessi (`src/contexts/AuthContext.tsx:990-1028`)

```typescript
const hasPermission = (permission: string): boolean => {
  if (!authState.user) return false;
  if (isPlatformAdmin()) return true;
  
  const { role } = authState.user;
  
  switch (permission) {
    case 'dashboard':
      return role === 'admin' || role === 'barber';  // ✅ Riconosce 'barber'
    case 'appointments':
      return role === 'admin' || role === 'barber';  // ✅ Riconosce 'barber'
    // ... altri permessi
  }
}
```

**OK**: La funzione `hasPermission()` riconosce correttamente il ruolo `'barber'`.

## Problemi Identificati

### 1. **Ruolo Non Aggiornato Quando Si Collega Staff a Utente**

**Scenario**:
1. Utente si registra → `profiles.role = 'client'`
2. Admin crea staff e collega `user_id` → `staff.user_id = user.id`
3. **PROBLEMA**: `profiles.role` rimane `'client'` invece di diventare `'barber'`

**Causa**: 
- `createStaff()` e `updateStaff()` non aggiornano `profiles.role`
- Il trigger `auto_create_staff_for_barber()` funziona solo profile → staff, non staff → profile

### 2. **Ruolo Non Ricaricato dal Database Dopo Login**

**Scenario**:
1. Utente fa login → ruolo caricato dal database e salvato in localStorage
2. Admin aggiorna `profiles.role` a `'barber'` nel database
3. Utente ricarica la pagina → **ruolo rimane quello vecchio in localStorage**

**Causa**:
- `initAuth()` carica il ruolo da localStorage, non dal database
- `refreshSession()` aggiorna solo il token, non il ruolo

### 3. **OAuth Crea Sempre Con Role='client'**

**Scenario**:
1. Utente fa login con Google OAuth
2. Se il profilo non esiste, viene creato con `role='client'`
3. Anche se l'utente ha già uno staff collegato, il profilo viene creato come `'client'`

**Causa**:
- OAuth callback (linea 224, 236, 246) crea sempre con `role='client'`
- Non verifica se esiste già uno staff con quel `user_id`

### 4. **Discrepanza Tra Ruoli Database e TypeScript**

- Database permette: `admin`, `manager`, `staff`, `user`, `client`, `barber`, `receptionist`, `owner`
- TypeScript permette solo: `admin`, `barber`, `client`

**Impatto**: Se un utente ha `role='manager'` nel database, TypeScript lo tratta come stringa generica.

## Punti Critici nel Codice

### 1. `src/contexts/AuthContext.tsx:375-379`
```typescript
// ⚠️ Usa ruolo da localStorage, non dal database
setAuthState({
  user,  // Ruolo potrebbe essere obsoleto
  isAuthenticated: true,
  isLoading: false,
});
```

### 2. `src/contexts/AuthContext.tsx:577`
```typescript
role: (profile as any).role ?? 'client',  // ⚠️ Fallback a 'client'
```

### 3. `src/contexts/AuthContext.tsx:224, 236, 246`
```typescript
// ⚠️ OAuth crea sempre con role='client'
role: 'client',
```

### 4. `src/services/api.ts:3120-3193` e `3196-3232`
```typescript
// ⚠️ NON aggiorna profiles.role quando si crea/aggiorna staff con user_id
async createStaff(...) { ... }
async updateStaff(...) { ... }
```

## Soluzioni Proposte

### 1. **Correzione Dati Esistenti**
- Script SQL per aggiornare `profiles.role` a `'barber'` per staff con `user_id`

### 2. **Trigger SQL Automatico**
- Trigger che aggiorna `profiles.role` a `'barber'` quando si crea/aggiorna staff con `user_id`

### 3. **Aggiornamento Codice TypeScript**
- Modificare `createStaff()` e `updateStaff()` per aggiornare anche `profiles.role`

### 4. **Refresh Ruolo dal Database**
- Modificare `initAuth()` per ricaricare il ruolo dal database invece di usare solo localStorage
- Aggiungere funzione `refreshUserRole()` per aggiornare il ruolo periodicamente

### 5. **OAuth Callback**
- Verificare se esiste staff con `user_id` prima di creare profilo con `role='client'`

## Conclusioni

Il problema principale è che:
1. **Il ruolo non viene aggiornato quando si collega uno staff a un utente**
2. **Il ruolo non viene ricaricato dal database dopo il login iniziale**

Questo causa la situazione in cui:
- Utenti con staff collegato hanno ancora `role='client'` o `role='admin'` in `profiles`
- Il sistema legge il ruolo obsoleto da localStorage
- L'utente viene trattato come cliente anche se dovrebbe essere barber
