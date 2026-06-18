# About page — audit + Cody invite text

_Companion to the Contact audit. Same depth. Spacing fixes already applied to the page._
_Date: 2026-05-27. Author: CTO._

---

## 1. About page — what's on the page right now

Five beats, in order:

1. **HERO** — "KDC exists because taste and performance were never meant to be a trade-off."
2. **THE WHY** — diagnosis of why KDC was started (the fragmented gap between agencies and internal teams).
3. **THE COLLECTIVE** — what KDC is structurally, paired with the camera + laptop duo image.
4. **FOUNDER** — Cody's bio, Paris leather-jacket portrait, pull quote, LinkedIn link.
5. **CLOSING** — "We take a limited number of partners. The brands we say yes to get all of it."

That ordering is right. Hero sets the stance, Why explains the founding tension, Collective answers _what is this thing,_ Founder makes it personal, Closing snaps it shut with the scarcity line. Don't reorder it.

---

## 2. Spacing — what I just changed

The page was technically correct but felt visually uneven. I made five surgical fixes:

- **Hero bottom padding** dropped from 120px → 80px to match the Contact and Home heroes. The page now lands the eye into THE WHY at the same rhythm as the rest of the site.
- **Section padding** normalized to 100/100 across THE WHY, THE COLLECTIVE, and FOUNDER (was 120/120 everywhere). The page is shorter, denser, and reads as one continuous editorial rather than five lectern slides.
- **Heading scale** normalized. THE WHY was capped at `text-[44px]` while every other section heading went to `text-[52px]`. They now all match.
- **Founder column rhythm.** The bio column was using `space-y-10/12` between every block, which left the pull quote floating uncomfortably below the bio paragraphs. I moved to deliberate margin pairs (`mb-8` after the name, `mb-10` after the bio) and put a thin divider line above the pull quote so it reads as a separate editorial beat instead of a stranded sentence.
- **CLOSING background** changed from `#F3F0EA` (a third cream) to the same `#FAFAFA` as the rest of the page, and the heading is now italic + center-aligned. This was the same fix we did on Contact. The page now lives in a single palette from top to bottom.

The page also got `max-w-[1100px]` on the hero headline so it stops stretching across the entire grid on huge monitors.

---

## 3. About page — full audit

Same lens I used on Contact: voice, rhythm, hierarchy, image weight, overlap with the rest of the site, what to cut.

### Voice — passes

The page is in Ellen's voice. No marketing throat-clearing. The diagnosis in THE WHY ("Agencies didn't know the brand — or the business — well enough to move it. Internal teams knew it intimately but never had the room to scale it without losing the thread") is the strongest paragraph on the entire site. It earns the founder bio that follows.

The pull quote in FOUNDER — _"The work I love is the work I'm built for — design-led, considered, customer-aware. KDC is for founders and teams who want a partner who knows the brand the way they do"_ — is also doing real work. It tells you what kind of partner Cody is without claiming a credential.

### Rhythm — passes after spacing fix

Before today: the page felt slow because every section was 120/120 with too-wide gaps between paragraphs. After today: tighter, more deliberate. Reads in roughly 90 seconds. About right for an About page.

### Hierarchy — passes

The eyebrow → headline → body pattern is clean. The Founder section gets the longest dwell because the photo column gives it visual weight. Good.

### Image weight — one open question

You asked whether there's an iPad-with-pictures shot somewhere. I checked everything in the repo.

- The five `i-*` Paris shots are all street portraits in the leather jacket (already used in Founder).
- `_DUG9698.jpg` is the rack shot (Home).
- `_DUG9728.jpg` is the camera + laptop duo (Collective).
- None of the screenshots in `src/imports/` is usable as an editorial portrait.
- The hero video has one frame around t=5.5s where Cody and Emma are at the studio with printed pictures pinned to the wall — that's the literal "brand-curation in progress" shot. It would work as a still, but pulling a still from the same video that auto-plays on the homepage risks looking redundant. I'd rather we don't use it.

My honest recommendation: **skip the image swap.** Your existing two photos (camera+laptop duo, Paris portrait) are already doing the brand-authenticity work — the first is literally Cody and Emma working on assets, the second is the editorial-portrait-of-the-founder shot. Adding a third image of Cody-at-iPad would dilute, not deepen.

If you do want the iPad beat, the right path is to source a real shot from Cody's photographer's SELECTS folder on Drive (you mentioned `_DUG9734.jpg` was an iPad-review frame in the curated batch). That goes into `src/imports/` via Finder. I can wire it into THE COLLECTIVE on five minutes' notice once it's in the repo.

### Overlap with the rest of the site — passes

The About page does not repeat Home. Home is _what we do._ About is _why we exist + who's behind it._ The only sentence that brushes Home's territory is the closing scarcity line, and that's deliberate — it's the same promise told from a different angle. Keep it.

### What to cut — nothing

The page is already at fighting weight. Five blocks, no padding paragraphs, no business cliches, no awards section, no "values" grid. It's an About page that respects the reader. Don't add anything.

---

## 4. Four Surfaces — single Substack link

Done on Home. The four chapter blocks (Brand / Content / Retention / Community) no longer link individually — they're now read-only descriptive blocks. One arrow link sits below the grid: "→ Read more on Substack." This is the cleaner pattern: it stops feeling like every word is a CTA.

---

## 5. Invite text for Cody — to send to 2–3 trusted reviewers

Copy-paste below. Cody can lightly personalize the salutation.

---

**Subject:** Quick eyes on the new site before we go live

Hi —

Before we launch the new Kenny Donna Collective site in the next day or two, I'd love a fresh set of eyes on it. You're one of two or three people I trust to be honest with me on this.

A few things to know before you click:

- **The material is there.** Copy, structure, photography, the founder section, the framework — it's all in place. This isn't me asking you to help me build it. It's me asking you to help me sharpen the last 5%.
- **It's iteration, not creation.** I'm not looking for "make it bigger / add a section / change the photo." I'm looking for: where does it land, where does it stall, what reads as off-brand, what one sentence would you cut.
- **Hero video — focus on the concept, not the edit.** The video editing is being handled by my team. We can stabilize, recolor, retime, recut. What I need from you is whether the _idea_ of the hero — the rhythm of moments, the mood, what it tells you about KDC before you read a single word — feels right. If something in the concept feels off, say so. The technical execution is solved.
- **We're a day or two from publishing.** So if something jumps out, this is the window.

The site: [insert preview link]

Thank you. I owe you one.

Cody

---

## 6. Status

Site is launch-ready. Today's work tightened the last visual unevenness on About, removed the per-block Substack links so the Four Surfaces reads as a framework not an ad, and produced the invite above. After Cody collects feedback from her three reviewers, we apply any last edits and flip `VITE_COMING_SOON` on `kdc-website-orke`.
