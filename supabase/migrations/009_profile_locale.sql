ALTER TABLE public.profiles
  ADD COLUMN locale TEXT NOT NULL DEFAULT 'en'
    CHECK (locale IN ('en', 'es', 'pt-BR'));
