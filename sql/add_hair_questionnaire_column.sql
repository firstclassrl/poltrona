ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS hair_questionnaire_enabled BOOLEAN DEFAULT false;

-- Force schema cache reload just in case
NOTIFY pgrst, 'reload schema';
