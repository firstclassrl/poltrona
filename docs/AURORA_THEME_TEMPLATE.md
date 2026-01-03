# Template Tema Aurora - Guida Completa per Replicazione

Questo documento descrive tutte le impostazioni del tema Aurora per permettere la replicazione identica del layout in altri temi, cambiando solo i colori.

## 📋 Indice

1. [Struttura HTML/JSX delle Pagine](#struttura-htmljsx-delle-pagine)
2. [Colori e Variabili CSS](#colori-e-variabili-css)
3. [Layout Desktop e Mobile](#layout-desktop-e-mobile)
4. [Sidebar](#sidebar)
5. [Componenti UI](#componenti-ui)
6. [Spazi e Padding](#spazi-e-padding)
7. [Separatori](#separatori)
8. [Background e Gradienti](#background-e-gradienti)

---

## 1. Struttura HTML/JSX delle Pagine

### Pattern Standard per Tutte le Pagine

**IMPORTANTE**: Tutte le pagine devono seguire questa struttura esatta:

```tsx
return (
  <div className="p-0 page-container-chat-style">
    <div className="w-full">
      <div className="flex flex-col space-y-6">
        {/* Contenuto della pagina */}
      </div>
    </div>
  </div>
);
```

**Note:**
- ❌ **NON** usare `page-card-chat-style` (rimossa per evitare doppio sfondo)
- ❌ **NON** usare `min-h-screen` o `h-full` nei container delle pagine
- ✅ Usare `space-y-6` o `space-y-8` per spaziare le sezioni

### File da Modificare

Applicare questa struttura a:
- `src/components/Dashboard.tsx`
- `src/components/Calendar.tsx`
- `src/components/Chat.tsx`
- `src/components/Clients.tsx`
- `src/components/Products.tsx`
- `src/components/Services.tsx`
- `src/components/Shop.tsx`
- `src/components/Settings.tsx`
- `src/components/WaitlistDashboard.tsx`
- `src/components/BarberProfile.tsx`
- `src/components/ClientProducts.tsx`
- `src/components/ClientShop.tsx`
- `src/components/ClientBookings.tsx`
- `src/components/ClientProfile.tsx`
- `src/components/ClientBookingCalendar.tsx`

---

## 2. Colori e Variabili CSS

### Definizione in `src/theme/palettes.ts`

```typescript
{
  id: 'aurora',
  name: 'Aurora (Bianco/Azzurro/Violetto)',
  description: 'Look luminoso e pulito, con tocchi aurora boreale.',
  trend: 'Bianco + Azzurro + Violetto (2025 clean web)',
  previewGradient: 'linear-gradient(135deg, #f7fbff 0%, #c8e4ff 40%, #c7c5ff 100%)',
  colors: {
    background: '#f4f7ff',
    surface: '#ffffff',
    surfaceAlt: '#eef3ff',
    primary: '#5b7cff',        // Colore sidebar principale
    primaryStrong: '#3c5fe6',
    accent: '#9b7bff',
    accentSoft: '#d8d0ff',
    accentContrast: '#0f1024',
    text: '#0f172a',
    textMuted: '#4b5563',
    border: '#d5def7',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
  },
}
```

### Gradiente Background

```css
/* Gradiente principale - SOSTITUIRE con i colori del nuovo tema */
linear-gradient(135deg, #f7fbff 0%, #c8e4ff 40%, #c7c5ff 100%)
```

**Per replicare in un nuovo tema:**
- Sostituire `#f7fbff` (inizio) con il colore chiaro del nuovo tema
- Sostituire `#c8e4ff` (medio) con il colore medio del nuovo tema  
- Sostituire `#c7c5ff` (fine) con il colore finale del nuovo tema

---

## 3. Layout Desktop e Mobile

### App.tsx - Struttura Principale

```tsx
return (
  <div className="app-theme-bg text-[var(--theme-text)]">
    <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
    
    {/* Main Content */}
    <div className="md:ml-64 pb-20 md:pb-0">
      <main className="text-[var(--theme-text)]">
        {renderActiveTab()}
      </main>
    </div>
  </div>
);
```

**Note:**
- `md:ml-64` = margin-left solo su desktop (>= 768px) per spostare il contenuto a destra della sidebar
- Su mobile: `margin-left: 0` (contenuto centrato)
- Su desktop: `margin-left: 16rem` (256px = larghezza sidebar)

### CSS Layout Container

```css
/* SOSTITUIRE [data-theme='aurora'] con [data-theme='NUOVO_TEMA'] */

/* Background a tutto schermo */
[data-theme='aurora'] body,
[data-theme='aurora'] html,
[data-theme='aurora'] #root {
  background: linear-gradient(135deg, #f7fbff 0%, #c8e4ff 40%, #c7c5ff 100%) !important;
  background-attachment: fixed !important;
  min-height: 100vh !important;
}

[data-theme='aurora'] .app-theme-bg {
  background: linear-gradient(135deg, #f7fbff 0%, #c8e4ff 40%, #c7c5ff 100%) !important;
  color: var(--theme-text);
  min-height: 100vh !important;
  position: relative !important;
  margin: 0 !important;
  padding: 0 !important;
  display: flex !important;
  flex-direction: column !important;
}

/* Main content area - Mobile e Desktop */
[data-theme='aurora'] .md\:ml-64 {
  background: linear-gradient(135deg, #f7fbff 0%, #c8e4ff 40%, #c7c5ff 100%) !important;
  background-attachment: fixed !important;
  position: relative !important;
  min-height: 100vh !important;
  display: flex !important;
  flex-direction: column !important;
  margin: 0 !important;
  margin-top: 0 !important;
  /* Su mobile: nessun margin-left, contenuto centrato */
  margin-left: 0 !important;
  padding: 0 !important;
  padding-top: 0 !important;
  top: 0 !important;
  left: 0 !important;
  align-items: stretch !important;
  align-content: flex-start !important;
}

/* Desktop: sposta contenuto a destra della sidebar */
@media (min-width: 768px) {
  [data-theme='aurora'] .md\:ml-64 {
    margin-left: 16rem !important; /* 64 * 0.25rem = 16rem = 256px */
    margin-top: 0 !important;
    top: 0 !important;
    display: flex !important;
    flex-direction: column !important;
  }
}

[data-theme='aurora'] main {
  background: transparent !important;
  padding: 0 !important;
  margin: 0 !important;
  margin-top: 0 !important;
  position: relative !important;
  top: 0 !important;
  width: 100% !important;
  max-width: 100% !important;
  align-self: flex-start !important;
}
```

---

## 4. Sidebar

### Navigation.tsx - Struttura Sidebar

```tsx
{/* Desktop Sidebar */}
<div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
  <div className="flex-1 flex flex-col min-h-0 glass-sidebar-dark aurora-sidebar">
    <div className="flex-1 flex flex-col pt-3 pb-4 overflow-y-auto">
      {/* Logo Section */}
      <div className="flex items-center justify-center flex-shrink-0 px-6 py-6 mb-2 aurora-logo-container">
        <img src={logo} alt="Logo" className="w-28 h-28 object-contain filter brightness-110 aurora-logo" />
      </div>
      
      {/* Separator Line Below Logo */}
      <div className="mx-4 mb-2 theme-separator-top"></div>
      
      {/* Navigation Items */}
      <nav className="mt-1 flex-1 px-4 space-y-1.5">
        {/* Nav items con classi: aurora-nav-item, aurora-nav-item-active, aurora-nav-item-inactive */}
      </nav>
      
      {/* Notification Button */}
      <div className="px-4 mt-4 mb-4">
        <button className="aurora-notification-button">
          {/* Notifiche */}
        </button>
      </div>
      
      {/* Separator Line Above User Info - RIMOSSA per Aurora */}
      {/* <div className="mx-4 mt-4 mb-4 theme-separator-bottom"></div> */}
      
      {/* User Info */}
    </div>
  </div>
</div>
```

### CSS Sidebar

```css
/* Sidebar principale - SOSTITUIRE primary color */
[data-theme='aurora'] .aurora-sidebar.glass-sidebar-dark {
  border-top-right-radius: 2rem !important; /* rounded-3xl */
  border-bottom-right-radius: 2rem !important; /* rounded-3xl */
  box-shadow: 
    0 10px 40px rgba(91, 124, 255, 0.2),
    0 0 0 1px rgba(91, 124, 255, 0.15) !important;
  backdrop-filter: blur(30px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(30px) saturate(180%) !important;
  margin: 1rem 0 1rem 1rem !important;
  background: #5b7cff !important; /* SOSTITUIRE con var(--theme-primary) */
  border: 1px solid rgba(91, 124, 255, 0.4) !important; /* SOSTITUIRE con primary color */
}

/* Logo Container */
[data-theme='aurora'] .aurora-logo-container {
  padding-top: 1.5rem;
  padding-bottom: 1rem;
}

[data-theme='aurora'] .aurora-logo {
  filter: brightness(1.1) drop-shadow(0 4px 12px rgba(91, 124, 255, 0.15)) !important;
  transition: transform 0.2s ease !important;
}

[data-theme='aurora'] .aurora-logo:hover {
  transform: scale(1.05);
}

/* Navigation Items - Pill Shape */
[data-theme='aurora'] .aurora-nav-item {
  border-radius: 9999px !important; /* rounded-full per pill shape */
  transition: all 0.2s ease !important;
  border: none !important;
}

[data-theme='aurora'] .aurora-nav-item-active {
  background: var(--theme-primary) !important;
  color: #ffffff !important;
  font-weight: 600 !important;
}

[data-theme='aurora'] .aurora-nav-item-inactive {
  color: rgba(255, 255, 255, 0.7) !important;
  background: transparent !important;
}

[data-theme='aurora'] .aurora-nav-item-inactive:hover {
  background: rgba(255, 255, 255, 0.1) !important;
  color: rgba(255, 255, 255, 0.9) !important;
}

/* Notification Button - Sempre con bordo */
[data-theme='aurora'] .aurora-notification-button {
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
}

[data-theme='aurora'] .aurora-notification-button:hover,
[data-theme='aurora'] .aurora-notification-button[aria-current="page"] {
  border-color: rgba(255, 255, 255, 0.4) !important;
}

/* Badge Navigation */
[data-theme='aurora'] .aurora-badge-nav {
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3) !important;
  border: 2px solid rgba(255, 255, 255, 0.2) !important;
  z-index: 10;
}
```

---

## 5. Container delle Pagine

### CSS Page Container

```css
/* Container principale delle pagine */
[data-theme='aurora'] .page-container-chat-style {
  padding: 0 !important;
  padding-top: 0 !important;
  background: transparent !important;
  width: 100% !important;
  max-width: 100% !important;
  display: block !important;
  position: relative !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: auto !important;
  margin: 0 !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
  margin-top: 0 !important;
  min-height: auto !important;
  height: auto !important;
  box-sizing: border-box !important;
}

[data-theme='aurora'] .page-container-chat-style > div:first-child {
  width: 100% !important;
  padding: 1.5rem !important;
  display: block !important;
  position: relative !important;
  top: 0 !important;
  left: auto !important;
  right: auto !important;
  bottom: auto !important;
  visibility: visible !important;
  opacity: 1 !important;
  margin: 0 auto !important; /* Centrato su mobile */
  margin-top: 0 !important;
  max-width: 100% !important;
}

/* Padding responsive */
@media (min-width: 768px) {
  [data-theme='aurora'] .page-container-chat-style > div:first-child {
    padding: 2rem !important;
  }
}

@media (min-width: 1024px) {
  [data-theme='aurora'] .page-container-chat-style > div:first-child {
    padding: 2.5rem !important;
  }
}

/* Spazi tra elementi */
[data-theme='aurora'] .page-container-chat-style h1,
[data-theme='aurora'] .page-container-chat-style h2,
[data-theme='aurora'] .page-container-chat-style h3 {
  margin-bottom: 0.75rem !important;
}

[data-theme='aurora'] .page-container-chat-style p {
  margin-bottom: 1rem !important;
}

[data-theme='aurora'] .page-container-chat-style .space-y-6 > * + * {
  margin-top: 1.5rem !important;
}

[data-theme='aurora'] .page-container-chat-style .space-y-8 > * + * {
  margin-top: 2rem !important;
}

/* Card di sfondo RIMOSSA - non usare page-card-chat-style */
[data-theme='aurora'] .page-card-chat-style {
  background: transparent !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  border: none !important;
  box-shadow: none !important;
  border-radius: 0 !important;
  width: 100% !important;
  display: block !important;
  position: relative !important;
  padding: 0 !important;
  margin: 0 !important;
}
```

---

## 6. Componenti UI

### Card

```css
[data-theme='aurora'] .aurora-card,
[data-theme='aurora'] .surface-card,
[data-theme='aurora'] .bg-white:not(.glass-sidebar-dark):not(.login-card-glass) {
  border-radius: 1.5rem !important; /* rounded-2xl */
  box-shadow: 0 4px 20px rgba(91, 124, 255, 0.1) !important;
  border: 1px solid color-mix(in srgb, var(--theme-border) 20%, transparent) !important;
  transition: all 0.2s ease !important;
}

[data-theme='aurora'] .aurora-card:hover,
[data-theme='aurora'] .surface-card:hover {
  box-shadow: 0 6px 24px rgba(91, 124, 255, 0.12) !important;
  transform: translateY(-2px);
}
```

**SOSTITUIRE**: `rgba(91, 124, 255, ...)` con il colore primary del nuovo tema

### Button

```css
[data-theme='aurora'] .aurora-button,
[data-theme='aurora'] button:not(.glass-sidebar-dark button) {
  border-radius: 0.75rem !important; /* rounded-xl */
  box-shadow: 0 2px 8px rgba(91, 124, 255, 0.1) !important;
  transition: all 0.2s ease !important;
}

[data-theme='aurora'] .aurora-button:hover,
[data-theme='aurora'] button:not(.glass-sidebar-dark button):hover {
  box-shadow: 0 4px 12px rgba(91, 124, 255, 0.15) !important;
  transform: translateY(-1px);
}
```

### Input

```css
[data-theme='aurora'] .aurora-input,
[data-theme='aurora'] input:not([type="checkbox"]):not([type="radio"]),
[data-theme='aurora'] textarea,
[data-theme='aurora'] select {
  border-radius: 0.75rem !important; /* rounded-xl */
  box-shadow: 0 2px 8px rgba(91, 124, 255, 0.05) !important;
  border: 1px solid color-mix(in srgb, var(--theme-border) 40%, transparent) !important;
  transition: all 0.2s ease !important;
}

[data-theme='aurora'] .aurora-input:focus,
[data-theme='aurora'] input:not([type="checkbox"]):not([type="radio"]):focus,
[data-theme='aurora'] textarea:focus,
[data-theme='aurora'] select:focus {
  box-shadow: 0 4px 12px rgba(91, 124, 255, 0.15) !important;
  border-color: var(--theme-primary) !important;
}
```

### Badge

```css
[data-theme='aurora'] .aurora-badge,
[data-theme='aurora'] .rounded-full {
  border-radius: 9999px !important;
  box-shadow: 0 2px 6px rgba(91, 124, 255, 0.1) !important;
}
```

### Modal

```css
[data-theme='aurora'] .aurora-modal {
  border-radius: 1.5rem !important; /* rounded-2xl */
  box-shadow: 0 20px 60px rgba(91, 124, 255, 0.15) !important;
}

[data-theme='aurora'] .aurora-modal + div {
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
}
```

### Avatar

```css
[data-theme='aurora'] .aurora-avatar {
  box-shadow: 0 4px 12px rgba(91, 124, 255, 0.15) !important;
}
```

---

## 7. Separatori

### CSS Separatori

```css
/* Separatore TOP (sotto logo) - Ingrandito a 5px */
[data-theme='aurora'] .theme-separator-top {
  display: block !important;
  visibility: visible !important;
  border-top-color: #ffffff !important; /* SOSTITUIRE con colore appropriato */
  opacity: 0.8 !important;
  border-top-width: 5px !important;
  height: 5px !important;
  margin: 0.75rem 0 !important;
}

/* Separatore BOTTOM (sotto notifiche) - RIMOSSO */
[data-theme='aurora'] .theme-separator-bottom {
  display: none !important;
  visibility: hidden !important;
}
```

**In Navigation.tsx:**
- ✅ Mantenere: `<div className="mx-4 mb-2 theme-separator-top"></div>` (sotto logo)
- ❌ Rimuovere/Commentare: `<div className="mx-4 mt-4 mb-4 theme-separator-bottom"></div>` (sotto notifiche)

---

## 8. Background e Gradienti

### Background Full Screen

```css
/* Background a tutto schermo - SOSTITUIRE gradiente */
[data-theme='aurora'] body,
[data-theme='aurora'] html,
[data-theme='aurora'] #root {
  background: linear-gradient(135deg, #f7fbff 0%, #c8e4ff 40%, #c7c5ff 100%) !important;
  background-attachment: fixed !important;
  min-height: 100vh !important;
}

[data-theme='aurora'] .app-theme-bg {
  background: linear-gradient(135deg, #f7fbff 0%, #c8e4ff 40%, #c7c5ff 100%) !important;
  color: var(--theme-text);
  min-height: 100vh !important;
  position: relative !important;
  margin: 0 !important;
  padding: 0 !important;
  display: flex !important;
  flex-direction: column !important;
}

[data-theme='aurora'] .md\:ml-64 {
  background: linear-gradient(135deg, #f7fbff 0%, #c8e4ff 40%, #c7c5ff 100%) !important;
  background-attachment: fixed !important;
  /* ... resto delle proprietà ... */
}

/* Rimuovi sfondi bianchi */
[data-theme='aurora'] .min-h-screen:not(.page-container-chat-style) {
  background: transparent !important;
}

[data-theme='aurora'] main {
  background: transparent !important;
}
```

### Background Sidebar

```css
/* Sidebar transparente per mostrare gradiente dietro */
[data-theme='aurora'] .hidden.md\:flex.md\:w-64 {
  background: transparent !important;
}

/* Gradiente anche dietro sidebar */
[data-theme='aurora'] .hidden.md\:flex.md\:w-64::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #f7fbff 0%, #c8e4ff 40%, #c7c5ff 100%);
  z-index: -1;
  background-attachment: fixed;
}
```

---

## 9. Checklist per Replicazione

### Passo 1: Aggiungere Nuovo Tema in `palettes.ts`

```typescript
{
  id: 'nuovo-tema',
  name: 'Nome Tema',
  description: 'Descrizione',
  trend: 'Trend',
  previewGradient: 'linear-gradient(135deg, COLOR1 0%, COLOR2 40%, COLOR3 100%)',
  colors: {
    // Sostituire con i colori del nuovo tema
    primary: '#COLORE_PRIMARY',
    // ... altri colori
  },
}
```

### Passo 2: Sostituire Selettori CSS

In `src/index.css`, cercare e sostituire:
- `[data-theme='aurora']` → `[data-theme='nuovo-tema']`
- `#5b7cff` → `var(--theme-primary)` o colore specifico
- `rgba(91, 124, 255, ...)` → `rgba(PRIMARY_R, PRIMARY_G, PRIMARY_B, ...)`
- Gradiente `linear-gradient(135deg, #f7fbff 0%, #c8e4ff 40%, #c7c5ff 100%)` → nuovo gradiente

### Passo 3: Verificare Struttura Pagine

Tutte le pagine devono avere:
```tsx
<div className="p-0 page-container-chat-style">
  <div className="w-full">
    <div className="flex flex-col space-y-6">
      {/* Contenuto */}
    </div>
  </div>
</div>
```

### Passo 4: Verificare Navigation.tsx

- Separatore top presente (sotto logo)
- Separatore bottom rimosso (sotto notifiche)
- Classi `aurora-*` applicate correttamente

### Passo 5: Test Mobile e Desktop

- ✅ Mobile: contenuto centrato, nessun margin-left
- ✅ Desktop: contenuto a destra sidebar, margin-left: 16rem
- ✅ Background gradiente visibile ovunque
- ✅ Sidebar con colore primary solido
- ✅ Separatori corretti

---

## 10. Colori da Sostituire

### Colori Hardcoded da Sostituire

| Colore Aurora | Uso | Sostituire con |
|--------------|-----|----------------|
| `#5b7cff` | Sidebar background | `var(--theme-primary)` |
| `#f7fbff` | Gradiente start | Colore chiaro nuovo tema |
| `#c8e4ff` | Gradiente middle | Colore medio nuovo tema |
| `#c7c5ff` | Gradiente end | Colore finale nuovo tema |
| `rgba(91, 124, 255, ...)` | Ombre e effetti | `rgba(PRIMARY_RGB, ...)` |
| `#ffffff` | Separatori | Colore appropriato nuovo tema |

### Variabili CSS da Usare

Preferire sempre variabili CSS quando possibile:
- `var(--theme-primary)` per colore principale
- `var(--theme-accent)` per accenti
- `var(--theme-text)` per testi
- `var(--theme-border)` per bordi
- `var(--theme-background)` per sfondi

---

## 11. Note Importanti

### ❌ Cose da NON Fare

1. **NON** usare `page-card-chat-style` come sfondo (rimossa)
2. **NON** aggiungere `min-h-screen` ai container delle pagine
3. **NON** usare `padding-left` invece di `margin-left` per il layout desktop
4. **NON** dimenticare di nascondere `theme-separator-bottom`
5. **NON** usare colori hardcoded quando esistono variabili CSS

### ✅ Cose da Fare

1. ✅ Usare sempre `[data-theme='TEMA']` per selettori specifici
2. ✅ Mantenere `background-attachment: fixed` per il gradiente
3. ✅ Usare `margin-left: 0` su mobile, `16rem` su desktop
4. ✅ Mantenere struttura HTML identica in tutte le pagine
5. ✅ Testare sempre su mobile e desktop

---

## 12. Esempio Completo: Nuovo Tema "Sunset"

### Step 1: Aggiungere in `palettes.ts`

```typescript
{
  id: 'sunset',
  name: 'Sunset',
  previewGradient: 'linear-gradient(135deg, #fff5f0 0%, #ffd4c4 40%, #ffb8a3 100%)',
  colors: {
    primary: '#f64f3b', // Rosso sidebar
    // ... altri colori
  },
}
```

### Step 2: Sostituire in CSS

```css
/* Da */
[data-theme='aurora'] .aurora-sidebar.glass-sidebar-dark {
  background: #5b7cff !important;
}

/* A */
[data-theme='sunset'] .aurora-sidebar.glass-sidebar-dark {
  background: #f64f3b !important; /* Rosso sunset */
}
```

### Step 3: Sostituire Gradiente

```css
/* Da */
background: linear-gradient(135deg, #f7fbff 0%, #c8e4ff 40%, #c7c5ff 100%) !important;

/* A */
background: linear-gradient(135deg, #fff5f0 0%, #ffd4c4 40%, #ffb8a3 100%) !important;
```

---

## 13. File da Modificare per Nuovo Tema

1. `src/theme/palettes.ts` - Aggiungere nuovo tema
2. `src/index.css` - Copiare tutte le regole `[data-theme='aurora']` e sostituire con nuovo tema
3. `src/components/Navigation.tsx` - Verificare separatori (già configurati correttamente)
4. `src/components/*.tsx` - Verificare struttura pagine (già configurate correttamente)

---

## 14. Testing Checklist

- [ ] Layout desktop: contenuto a destra sidebar
- [ ] Layout mobile: contenuto centrato
- [ ] Background gradiente visibile ovunque
- [ ] Sidebar con colore primary corretto
- [ ] Separatore top presente e spesso (5px)
- [ ] Separatore bottom rimosso
- [ ] Card con border-radius e ombre corrette
- [ ] Button con stile moderno
- [ ] Input con stile moderno
- [ ] Spazi tra elementi corretti
- [ ] Padding responsive funzionante

---

**Fine Documentazione**

Per domande o chiarimenti, consultare il codice sorgente del tema Aurora come riferimento.
