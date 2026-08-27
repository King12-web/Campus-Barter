# Campus Barter

**Trade skills, not money.** A student-to-student platform where you offer what you're good at and get help with what you need — matched automatically, on your own campus first.

Built for Nigerian university students, covering 330+ institutions nationwide.

---

## Why this exists

Students are skill-rich and cash-poor. A campus is full of people who could tutor each other, design a CV, fix a laptop, or edit a video — but there's no easy way to find them. Campus Barter is a digital noticeboard for exactly that kind of trade: no money changes hands, just skills.

## Features

- **Real accounts** — email/password auth via Firebase, with email verification and password reset
- **Cloud-synced profiles** — sign in on any device and your skills, campus, and history follow you
- **Automatic matching** — flags students whose skills complement yours in both directions
- **Campus-first browsing** — your board defaults to your own institution, with a toggle to widen the search; in-person-only skills are filtered out (and clearly labelled) when browsing other campuses
- **Full trade lifecycle** — propose a swap, accept or decline, complete the trade, rate each other
- **WhatsApp handoff** — once a trade is accepted, a pre-filled WhatsApp link opens between both parties; numbers stay private until that point
- **Derived notifications** — a real activity feed built from trade status changes and profile updates, with no duplicate data store to keep in sync
- **Self-healing ratings** — each person recalculates their own average rating from completed trades, respecting Firestore security rules that only allow you to write your own data
- **Responsive, mobile-first design** — a genuine second layout at desktop widths (horizontal nav, multi-column grid), not just a stretched phone view
- **Basic bot defence** — a honeypot field on signup and a real Nigerian-mobile-number format check on WhatsApp numbers

## Tech stack

- **Frontend:** vanilla HTML, CSS, and JavaScript — no framework. Every page is self-contained.
- **Backend:** Firebase Authentication + Cloud Firestore (no custom server)
- **Hosting:** GitHub Pages
- **Data model:** three Firestore collections — `profiles`, `trades`, `activity` — each with its own security rules restricting writes to their rightful owner

## Architecture notes

- `js/auth.js`, `js/db.js`, `js/trades.js`, `js/activity.js` — small, single-responsibility engines. Pages never talk to Firebase directly; they call these instead.
- No shared UI framework: each page (`join.html`, `dashboard.html`, `trades.html`, etc.) is a standalone file with its own HTML/CSS/JS. Deliberate for a project this size — the natural next step is a React migration once the vanilla-JS pain points below start to bite harder.
- Institutions dataset (330+ Nigerian tertiary institutions) is bundled directly in the client rather than fetched from a third-party API, since it changes rarely and a signup flow shouldn't depend on someone else's uptime.

## Known limitations (honest, on purpose)

- Ratings update on the *rated* person's next visit, not instantly for the other party — a deliberate trade-off to respect Firestore's "you can only write your own document" rule without needing a paid Cloud Functions backend.
- Institution name is set at signup and isn't editable — a deliberate simplicity decision, since students can already browse any campus via the dashboard switcher.
- Matching logic is currently duplicated across a couple of pages rather than shared — a known candidate for the eventual React refactor.

## Setup

1. Clone the repo.
2. Create a Firebase project with Authentication (Email/Password) and Firestore enabled.
3. Fill in `js/firebase-config.js` with your project's config values.
4. Paste the contents of `firestore.rules` into your Firestore Rules tab and publish.
5. Open `index.html` with a local server (e.g. VS Code's Live Server) or deploy the folder to GitHub Pages.

## The build

This project started as a way to practice JavaScript fundamentals and grew into a full authenticated, database-backed product — landing page, signup, sign-in, a live board with real matching, a complete trade lifecycle, and a notifications feed, all shipped and tested with real accounts.