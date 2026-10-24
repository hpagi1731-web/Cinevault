# CineVault — Movie Catalogue

A responsive static movie catalogue starter with:
- Dark cinematic interface and mobile layout
- Search, genre filters, sorting, movie detail modal
- Watchlist saved in browser localStorage
- Admin demo panel to add/remove custom movie entries
- Export custom catalogue as JSON

## Run locally
Open `index.html` in a modern browser. No build tools are required.

## Free static hosting
You can publish this folder using GitHub Pages, Cloudflare Pages, or Netlify's static site hosting. Upload the contents of this folder to your chosen provider.

## Important limitations
- The admin panel is a **local demo**, not secure authentication. Added titles are stored only in the current browser and device.
- For real public admin management, add a backend/database and authentication (for example Supabase with proper row-level security).
- Sample movies and ratings are illustrative, not verified real listings.
- Poster URL field accepts public HTTP(S) image URLs. Use images you have permission to use.
- This is a catalogue, not a streaming service. Add only authorized trailers, embeds, and links.

## Files
- `index.html` — page structure
- `styles.css` — responsive styling
- `app.js` — sample data and catalogue/admin interactions
