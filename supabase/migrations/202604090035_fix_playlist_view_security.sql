-- Make the public playlist view obey RLS instead of running as its creator.
-- This removes the Supabase "Security definer view" warning while keeping
-- the published playlist rows readable through the API.

alter view public.rapcade_playlist_public
set (security_invoker = true);
