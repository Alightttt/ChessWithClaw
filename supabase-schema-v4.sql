CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id text PRIMARY KEY,
    subscription jsonb NOT NULL,
    last_notified_at timestamptz,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow backend service role to perform all actions
DROP POLICY IF EXISTS "Allow service role all" ON public.push_subscriptions;
CREATE POLICY "Allow service role all" ON public.push_subscriptions FOR ALL USING (true);
