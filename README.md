# Pickleball Fee Splitter

A static web app for splitting pickleball court fees among participants. No build step — plain HTML/CSS/JS, so it hosts directly on GitHub Pages.

## Features

- Add multiple courts, each with its own fee and an optional "Paid by" owner
- When 2+ courts have different owners, the Summary shows a Reimbursements breakdown of how much is owed back to each person (their share of the total pool, collected proportionally as participants pay). Leave "Paid by" blank (or the same on every court) and this stays hidden — the app behaves as a single-owner splitter by default
- Mass-add participants by pasting a numbered list (e.g. `1. johanna`), or add one at a time
- Master list of members is remembered across events, so new event dates can reuse or tweak the previous roster
- Per-event checklist to mark who has paid, with collected/remaining totals
- Event access is gated by date + a shared password (`hizon` by default) — this is a light gate only, not real security, since the password is visible in the source
- Generates a shareable PNG summary (courts, total, per-person amount, participant list) that excludes paid/unpaid status

## Running locally

Just open `index.html` in a browser, or serve the folder with any static file server:

```
npx serve .
```

## Data storage

All data (master list + per-date events) is saved in the browser's `localStorage` under the key `pickleball-fee-splitter-data`. Data is local to the browser/device — it isn't synced anywhere.

## Deploying to GitHub Pages

1. Push this repo to GitHub.
2. In the repo settings, go to **Pages** and set the source to the `main` branch, root folder.
3. The site will be available at `https://<username>.github.io/<repo>/`.

## Changing the password

Edit the `APP_PASSWORD` constant near the top of `script.js`.
