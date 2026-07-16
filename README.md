# MomSub

Nanny management platform for recurring schedules, weekly hour approvals, and
dispute resolution between parents, nannies, and admins.

## Run locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```
   npm install
   ```
2. Start the dev server:
   ```
   npm run dev
   ```
   The app runs at http://localhost:3000.

## Useful scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the local dev server |
| `npm run build` | Production build to `dist/` |
| `npm run lint` | Type-check with `tsc --noEmit` |
| `npm run test:rules` | Run Firestore security-rules tests against the emulator |

## Deploying Firestore security rules

```
firebase deploy --only firestore:rules
```
