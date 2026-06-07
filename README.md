# Family Bingo

A private, installable family bingo game built with React, Vite, and Convex.

## Included

- Username/password login with no public signup screen
- Server-side filtering so players cannot read ideas tagged specifically about them
- Idea submission and people tagging
- Preferential ranked voting
- Top-50 shortlist and personal 24-item card selection
- Playable 5x5 bingo card with a free centre square
- Completion notes that can be viewed and edited later
- Automatic timezone-aware stage scheduling
- Winner notifications and an ordered leaderboard
- Privacy-safe views of other players' completion progress
- Admin reset, idea removal, and user/person management
- Editable player profile colours and icons
- Flexible resets that can preserve users while clearing questions
- Forced temporary-password replacement on first login
- Automatic random completion of cards with fewer than 24 manual picks
- Salted PBKDF2-SHA-256 password hashing with legacy-password migration
- PWA manifest, icons, offline asset caching, and responsive layouts

## Run locally

```bash
npm install
npm run dev
```

Sign in as `josh`, `alex`, `jamie`, `sam`, or `taylor` with password `demo`. Josh is the game admin and can schedule or advance phases, add users and non-user people, remove first-stage ideas, and reset the game. Reset preserves Josh as the sole user and returns the game to the ideas stage.

## Connect Convex

```bash
npx convex dev
```

After selecting or creating a Convex project, run `npx convex run seed:seed` once. The production schema and functions live in [`convex/`](./convex). The privacy-sensitive visible-ideas filter is enforced in the Convex query, not only in the interface.

Passwords are salted and hashed in Convex using PBKDF2-SHA-256. Seeded accounts use temporary passwords and must replace them on first login.

## Checks

```bash
npm run lint
npm run build
```
