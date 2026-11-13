CINEVAULT FILES

Upload these files to the ROOT of your GitHub repository hpagi1731-web/Cinevault:
index.html, styles.css, config.js, app.js, admin.html, admin.js.
Keep supabase-setup.sql as a local reference and run its SQL in Supabase Dashboard > SQL Editor after reviewing it.

Public site: https://hpagi1731-web.github.io/Cinevault/
Admin page: https://hpagi1731-web.github.io/Cinevault/admin.html

Admin login: use your existing Supabase Auth user. The configured authorised email is hitsnizam@gmail.com. Do not send your password to anyone.

The admin URL is not secret. Security depends on Supabase Auth and Row Level Security policies. The SQL allows public SELECT but restricts INSERT/UPDATE/DELETE to the authorised email. Review existing policies before running SQL, especially if you have other policies already in place.

Expected table: public.movies with id (auto-generated), title, year, genre, rating, description, poster_url, created_at. This version intentionally has no download field or download button.

The Supabase publishable key in config.js is intended for browser use. NEVER use the service_role key in frontend code. Keep RLS enabled. If your table schema differs, adapt the code and SQL before deploying.
