-- Aggiunge la colonna calendar_view_mode alla tabella shops
-- Valori possibili: 'split' (diviso tra mattina e pomeriggio) o 'full' (giornata intera)
-- Default: 'split' per mantenere la compatibilità con il comportamento esistente

ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS calendar_view_mode TEXT DEFAULT 'split' CHECK (calendar_view_mode IN ('split', 'full'));

-- Commento sulla colonna
COMMENT ON COLUMN public.shops.calendar_view_mode IS 'Modalità di visualizzazione del calendario: split (diviso tra mattina e pomeriggio) o full (giornata intera)';




