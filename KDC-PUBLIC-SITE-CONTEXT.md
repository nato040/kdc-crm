# KDC Public Website — Project Context Handoff

_For starting new chats with full context on the kennydonnacollective.com public site._
_Owner: Phase (COO). CTO: Claude. Date: 2026-05-29._

---

## 1. What KDC is

Kenny Donna Collective. An editorial marketing collective for design-led consumer brands. Positioning: McKinsey × Toteme. Founded by Cody Lynn Abt. Operates with a hard cap of **twelve partners at a time**, by invitation. Phase is COO. The site sells the partnership, not the agency.

KDC's proprietary framework is **The Four Surfaces**: Brand, Content, Retention, Community. The four "surfaces" of a modern consumer brand. KDC owns how they connect.

KDC's marketing positioning is "Marketing, shaped like a brand."

---

## 2. Current state

Site is launch-ready as of 2026-05-29. Waiting on Coming Soon gate flip and a final founder photo swap.

**Live URL:** https://kennydonnacollective.com
**Preview URL (unlocks the gate for one browser via localStorage):** https://kennydonnacollective.com/?preview=kdc2026
**Re-lock URL:** https://kennydonnacollective.com/?preview=off

**GitHub repo:** https://github.com/nato040/kdc-website
**Vercel project:** `kdc-website-orke` under team `nato040s-projects` (team id `team_ingBnbQXnuXGraAl5VErpHo3`). This is the LIVE project. There are other dormant Vercel projects under the same org — ignore them.
**Auto-deploy:** Vercel deploys on push to `main`. ~60-90 seconds from push to READY.
**Coming Soon switch:** Vercel env var `VITE_COMING_SOON`. Toggle in Vercel dashboard → redeploy.

---

## 3. Stack & architecture

- Vite + React + TypeScript
- React Router (`createBrowserRouter`)
- Tailwind utility classes + inline `style` objects (the Figma Make export started this way; we kept it)
- Repo root: `/Users/teodoropasiak/KDC-Public-website/kdc-public-site/`
- Source: `src/app/` (pages, components, routes, site-mode)
- Images: `src/imports/` (compressed JPGs, photographer prefix `_DUG####`)
- Hero video: `src/imports/kenny-donna-hero.mp4` (~900KB, 9.5s loop, 1280×720, 30% desaturated)
- Originals (large source files): suffixed `.orig.jpg` and `.gitignored` via `*.orig.*` pattern

---

## 4. Editorial vocabulary (treat as canon)

Sections across the site use a **"THE [X]"** eyebrow taxonomy:

| Eyebrow | Page | What it marks |
|---|---|---|
| THE WHY | About | Why KDC was founded |
| THE PROBLEM | Home | The diagnosis fragmented brands face |
| THE FOUR SURFACES | Home | KDC's framework (Brand / Content / Retention / Community) |
| THE COLLECTIVE | About | What KDC is structurally |
| THE PARTNERSHIP | Home | How KDC engages (twelve partners, by invitation) |
| THE WORK | Work | The capability inventory |
| OUTCOMES | Work | Numerical proof (30-35% CRM rev, +112% YoY DTC) |

The **footer "Index"** is a manifesto arc rendering chapter titles with arrow connectors:

`The Why → The Problem → The Four Surfaces → The Collective → The Partnership → The Work`

Implemented in `src/app/components/Root.tsx`. Each link uses anchor-scrolling via the `ScrollToHash` component.

---

## 5. Page-by-page (live structure)

### Home (`src/app/pages/Home.tsx`)
1. **HeroCarousel** — full-bleed looping video. Tagline: "Marketing, shaped like a brand." Sub: "A connected marketing architecture built from brand and designed for growth."
2. **THE PROBLEM** — diagnosis ("It's not that your brand needs more marketing.")
3. **WHO WE WORK WITH** — audience qualifier paired with the rack image (`_DUG9698.jpg`)
4. **THE FOUR SURFACES** — eyebrow + heading + paragraph + 4 descriptive chapter blocks (no per-block links). Single "→ Read more on Substack" link below the grid. Closes with italic line: "When channels align, growth accelerates."
5. **THE PARTNERSHIP** — "We don't onboard, deliver, and disappear. We embed." Mentions the twelve-partner cap.
6. **WHERE WE SIT** — italic editorial pause, centered: "We shape what you're creating into how it shows up across every customer moment."
7. **CTA** — dark close on `#171717`: "The work begins with a conversation." + link to /contact

Palette: single cream (`#FAFAFA`) scroll plus the single dark CTA close. No more color jumping between sections.

### About (`src/app/pages/About.tsx`)
1. **HERO** — full-width iPad-with-moodboard image (`_DUG9734.jpg`). No eyebrow, no headline. The image opens the page cinematically. _(Phase asked to drop the headline 2026-05-29.)_
2. **THE WHY** — "Kenny Donna Collective started from a frustration Cody knew from both sides of the table."
3. **THE COLLECTIVE** — "KDC is not an agency. It's a small, focused team..." paired with `_DUG9728.jpg` (Cody + Emma at studio)
4. **FOUNDER** — currently uses `i-vgrVGvj-X2.jpg` (Paris leather jacket). _Open item: Phase wants this swapped for a white blazer Paris portrait. Bytes need to come from Drive via Finder drop (see §7 constraint)._
5. _No CLOSING section_ — removed 2026-05-29 per Phase. Page ends on the Founder bio + LinkedIn link.

### Work / Case Studies (`src/app/pages/CaseStudies.tsx`)
1. **HERO** — eyebrow `SELECTED EXPERIENCE` + headline "What connected marketing systems make possible."
2. **THE WORK** — five thematic blocks: Brand and strategy / Marketing systems designed to scale / **Our own retention platform** (KDC's proprietary CRM, in-house built, replaces "SMS strategy") / Beyond the brand / Analytics and measurement
3. **OUTCOMES** — two stat blocks: `30-35%` CRM Revenue Contribution / `+112%` YoY DTC Growth. Big serif numerals (88px desktop). Sourced from Figma Make original.
4. **CATEGORIES** — industries list: Fashion and apparel / Athletic and activewear / Beauty / Wellness / Lifestyle and home
5. _No CLOSING section_ — removed 2026-05-29.

### Signals (`src/app/pages/Signals.tsx`)
Single editorial subscribe landing. Eyebrow + headline + body + Substack link. No fake article grid. _No CLOSING section_ as of 2026-05-29.

### Contact (`src/app/pages/Contact.tsx`)
Two blocks. Hero "Begin a conversation." Body order is **invitation first → email → italic qualifier last**: "We say yes when the brand and the partnership match." Reordered 2026-05-29 per Phase ("door held open, then quiet note that not everyone walks through").

### ComingSoon (`src/app/pages/ComingSoon.tsx`)
Standalone page shown when `VITE_COMING_SOON=true` and no preview key. Logo + brand line ("Marketing, shaped like a brand.") + Coming Soon label + email + Instagram/Substack links.

### Dead pages (in repo but not routed)
- `Approach.tsx` — dropped per Phase's "focus on founder" directive
- `Services.tsx` — dropped same time

Don't waste edits on these. Routes are defined in `src/app/routes.ts`.

---

## 6. Voice rules (Ellen's voice — Phase ratified)

**Things that are right:**
- Editorial, declarative, no marketing throat-clearing
- Diagnose-then-prescribe rhythm
- Concrete nouns over vague ones (Klaviyo, Intermix, Rag & Bone — real names move)
- Short clean sentences. Two-sentence beats. Periods over connectors.

**Things to avoid:**
- **Em-dashes (`—`)** — Phase flagged these as "AI language" on 2026-05-29. All em-dashes have been stripped from visible copy across About, Home, Work, Signals. Replace with commas, periods, or colons depending on context. Code comments still contain em-dashes (not user-visible).
- "Drive results / unlock value / leverage / synergize" — no. Already pruned.
- Awards lists, fake stat blocks, fake client logos, fake testimonials.
- Overclaiming. The OUTCOMES section uses "indicative results" framing for a reason.

**Things to keep:**
- "Marketing, shaped like a brand." (tagline)
- "The work begins with a conversation." (CTA)
- "Few partners, full attention." (positioning compression)
- "We say yes when the brand and the partnership match." (contact filter)

---

## 7. Workflow constraints (known + verified)

### What works
- **GitHub Desktop on Phase's Mac** — the only push path. Phase opens GHD, sees commits, clicks Push origin. Vercel auto-deploys.
- **Vercel auto-deploy** — pushing to `main` triggers a build on project `kdc-website-orke`. ~60-90 sec to READY.
- **Coming Soon flip** — `VITE_COMING_SOON` env var on Vercel. Documented in `PUBLISH-WORKFLOW.md` at repo root.
- **Preview key** — `?preview=kdc2026` writes localStorage flag and reveals full site. `?preview=off` re-locks.
- **Drive MCP for metadata** — `search_files`, `list_recent_files`, `get_file_metadata` all work. Can identify files, sizes, parents.
- **Vercel MCP** — `list_deployments`, `get_deployment_build_logs`, `list_teams` work for monitoring deploys.

### What doesn't work (don't waste cycles)
- **Pushing from the sandbox** — no GitHub credentials in the sandbox; Mac Keychain isn't readable. Push hand-off to Phase via GitHub Desktop.
- **Drive bytes → repo** — `download_file_content` returns a 14MB base64 blob that lands at a Mac temp path (`/var/folders/g2/...`) the sandbox can't reach. `drive.google.com` is also blocked by the workspace network allowlist. So image bytes from Drive can ONLY get into `src/imports/` via Phase downloading in the browser and dragging into Finder.
- **Chat-pasted images** — same problem. Images Phase pastes in chat don't sync to `/uploads/`. I can see them visually but the file bytes aren't on disk.
- **Deleting files inside `.git/`** — the sandbox can't `rm` files there by default. When git left a stale `.git/index.lock` mid-task, used `mcp__cowork__allow_cowork_file_delete` to grant permission, then the lock cleared. Pattern: if a delete fails with "Operation not permitted", request the delete permission first.

### Repo workflow on the sandbox side
- Stage + commit via bash (`git add`, `git commit`) — works.
- Push — fails (no auth).
- `.gitignore` includes `*.orig.*` for large source originals (12MB+ photographer raws).

---

## 8. Image inventory in `src/imports/`

| File | Content | Used on |
|---|---|---|
| `_DUG9698.jpg` (319KB) | Cody on the rack | Home → WHO WE WORK WITH |
| `_DUG9728.jpg` (113KB) | Cody + Emma at studio (camera + laptop duo) | About → THE COLLECTIVE |
| `_DUG9734.jpg` (85KB) | iPad with moodboard (Apple Pencil curation) | About → HERO |
| `i-vgrVGvj-X2.jpg` (149KB) | Paris leather jacket portrait | About → FOUNDER _(open item: Phase wants this swapped)_ |
| `kenny-donna-hero.mp4` (~900KB) | 9.5s loop hero video, 30% desat, 3 segments | HeroCarousel |
| `kenny-donna-hero-poster.jpg` (99KB) | Poster frame for the hero video | HeroCarousel |
| `kenny_donna_collective_logo_transparent-1.png` (34KB) | The KDC logo | Nav + Coming Soon |

`paris 7.jpg` — leftover cruft from Phase, untracked, ignore.

---

## 9. Open items

1. **Founder photo swap.** Replace `i-vgrVGvj-X2.jpg` (leather jacket) with white blazer Paris portrait. Bytes are NOT in the repo yet. Path: Phase opens Drive Paris folder ([1nQ-TnJAKCu4cCFLQCVXfb2T6vY7q7_-l](https://drive.google.com/drive/u/0/folders/1nQ-TnJAKCu4cCFLQCVXfb2T6vY7q7_-l)), browses thumbnails, identifies the white blazer shot, downloads, drops into `src/imports/` as `cody-paris-portrait.jpg`. Then Claude wires the single import line in `About.tsx`.
2. **Cody invite to reviewers.** Drafted in `/Users/teodoropasiak/kdc-crm/about-audit-and-cody-invite.md`. Phase sends to 2-3 trusted people for feedback. Pending Cody's send.
3. **Flip `VITE_COMING_SOON=false`** on Vercel when ready to publish. Documented in repo's `PUBLISH-WORKFLOW.md`.

---

## 10. Key files reference

- **Pages**: `src/app/pages/{Home, About, CaseStudies, Signals, Contact, ComingSoon}.tsx`
- **Layout / nav / footer**: `src/app/components/Root.tsx`
- **Hero video**: `src/app/components/HeroCarousel.tsx`
- **Section divider**: `src/app/components/SectionDivider.tsx`
- **Anchor-scroll on route change**: `src/app/components/ScrollToHash.tsx`
- **Coming Soon switch logic**: `src/app/site-mode.ts` (reads `VITE_COMING_SOON`)
- **Routes + gate evaluation**: `src/app/routes.ts`
- **Project memory** (auto-loaded each chat):
  - `KDC public site → Vercel static, Squarespace killed`
  - `KDC team — who's who` (Cody = founder/woman, Phase = COO; route platform asks through Phase)
  - `KDC positioning & pricing doc` (Drive)
  - `Chrome extension blocked by org admin`
- **Companion docs in `/Users/teodoropasiak/kdc-crm/`**:
  - `about-audit-and-cody-invite.md` — About page audit + invite text for trusted reviewers
  - `KDC-PUBLIC-SITE-CONTEXT.md` — this file

---

## 11. Quick-start checklist for a new chat

If you're a new agent picking this up:

1. Read this file end to end.
2. Skim `/Users/teodoropasiak/kdc-crm/about-audit-and-cody-invite.md` for the most recent editorial reasoning.
3. Read `src/app/components/Root.tsx` to see the nav + footer Index.
4. Read whichever page file the user is asking about.
5. For any image task: assume Drive bytes can't reach the repo and plan around Finder-drop.
6. For any push: stage + commit on the sandbox, then hand off to Phase for GHD push.
7. Watch for em-dashes. Phase notices.
