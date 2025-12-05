-- ============================================
-- Tabella Notifications per notifiche in-app
-- ============================================

-- Crea tabella notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- può essere staff_id o client_id
    user_type TEXT NOT NULL CHECK (user_type IN ('staff', 'client')),
    type TEXT NOT NULL CHECK (type IN ('new_appointment', 'appointment_cancelled', 'appointment_reminder', 'system')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}', -- dati aggiuntivi (es. appointment_id, client_name, etc.)
    read_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici per query performanti
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_notifications_shop ON public.notifications(shop_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Gli utenti possono vedere solo le proprie notifiche
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT
    USING (
        user_id = auth.uid()
        OR 
        -- Staff può vedere notifiche del proprio shop
        EXISTS (
            SELECT 1 FROM public.staff 
            WHERE staff.id = auth.uid() 
            AND staff.shop_id = notifications.shop_id
        )
    );

-- Policy: Solo il sistema (service_role) può inserire notifiche
CREATE POLICY "Service role can insert notifications" ON public.notifications
    FOR INSERT
    WITH CHECK (true); -- N8N userà service_role key

-- Policy: Gli utenti possono aggiornare solo le proprie notifiche (per marcare come lette)
CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Policy: Gli utenti possono eliminare solo le proprie notifiche
CREATE POLICY "Users can delete own notifications" ON public.notifications
    FOR DELETE
    USING (user_id = auth.uid());

-- ============================================
-- Funzione helper per contare notifiche non lette
-- ============================================

CREATE OR REPLACE FUNCTION public.get_unread_notifications_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT COUNT(*)::INTEGER 
    FROM public.notifications 
    WHERE user_id = p_user_id AND read_at IS NULL;
$$;

-- ============================================
-- Commenti per documentazione
-- ============================================

COMMENT ON TABLE public.notifications IS 'Notifiche in-app per staff e clienti';
COMMENT ON COLUMN public.notifications.type IS 'Tipo: new_appointment, appointment_cancelled, appointment_reminder, system';
COMMENT ON COLUMN public.notifications.data IS 'Dati JSON aggiuntivi (appointment_id, client_name, service_name, etc.)';






