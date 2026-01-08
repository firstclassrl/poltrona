-- Esegui questo script DOPO esserti registrato nell'app
-- Sostituisci 'tuo@email.com' con la tua email reale

UPDATE public.profiles
SET role = 'owner'
WHERE email = 'tuo@email.com'; -- <--- INSERISCI QUI LA TUA MAIL

-- Verifica il cambiamento
SELECT email, role, full_name FROM public.profiles WHERE email = 'tuo@email.com';
