# Pablo Ruiz Uroz — portfolio

1:1 local copy of the Framer site, with no Framer dependency. Astro builds static HTML; the ASCII scenes and labels are React components.

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static site in dist/
```

- Content: `src/pages/index.astro` (home) and `src/data/projects.json` (the four projects and their case studies; each one becomes `/work/<slug>`).
- Styles and breakpoints (desktop ≥ 1200, tablet 810–1199, phone < 810): `src/styles/global.css`.
- Components ported from Framer: `src/components/*.tsx`. `src/lib/framer-shim.ts` replaces the three Framer imports they used.
- Images: `public/images/`.

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` builds and publishes the site on every push to `main`. The repo is named `pruizz.github.io`, so the site is served at https://pruizz.github.io.

One-time setup on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Own domain (e.g. a `.dev`): set `site` in `astro.config.mjs` to it, add `public/CNAME` containing the domain, point the DNS at GitHub Pages and tick **Enforce HTTPS** (required for `.dev`).
