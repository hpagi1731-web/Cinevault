-- Review and run in Supabase > SQL Editor. Assumes movies columns:
-- id, title, year, genre, rating, description, poster_url, created_at.
alter table public.movies enable row level security;
drop policy if exists "Public can read movies" on public.movies;
create policy "Public can read movies" on public.movies for select to anon,authenticated using (true);
drop policy if exists "Admin can insert movies" on public.movies;
create policy "Admin can insert movies" on public.movies for insert to authenticated with check (lower(auth.jwt()->>'email')='hitsnizam@gmail.com');
drop policy if exists "Admin can update movies" on public.movies;
create policy "Admin can update movies" on public.movies for update to authenticated using (lower(auth.jwt()->>'email')='hitsnizam@gmail.com') with check (lower(auth.jwt()->>'email')='hitsnizam@gmail.com');
drop policy if exists "Admin can delete movies" on public.movies;
create policy "Admin can delete movies" on public.movies for delete to authenticated using (lower(auth.jwt()->>'email')='hitsnizam@gmail.com');
alter table public.movies add column if not exists created_at timestamptz default now();
-- Ensure id has a generated UUID default if it does not already.
-- NEVER place the Supabase service_role key in any website file.
