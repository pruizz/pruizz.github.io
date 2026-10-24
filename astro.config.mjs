import { defineConfig } from "astro/config"
import react from "@astrojs/react"

// The repo is named pruizz.github.io, so the site lives at the domain root (no `base` needed).
// With your own domain later: change `site` and add public/CNAME with that domain.
export default defineConfig({ site: "https://pruizz.github.io", integrations: [react()], devToolbar: { enabled: false } })
