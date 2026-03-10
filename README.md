# CallBoard — Aircall Leaderboard

A live call performance leaderboard that connects to your Aircall account.

## Why a proxy server?

Browsers block direct API calls to third-party services (CORS policy).
This server sits in the middle: your browser talks to `localhost:3000`,
which forwards requests to Aircall and returns the response.

## Setup (2 minutes)

### Requirements
- Node.js 16 or higher — download from https://nodejs.org

### Steps

1. Open a terminal in this folder
2. Start the server:

```bash
node server.js
```

You should see:
```
✅  CallBoard running at http://localhost:3000
```

3. Open **http://localhost:3000** in your browser
4. Click **Configure API** and enter:
   - **API ID** — from Aircall Dashboard → Integrations → API Keys
   - **API Token** — your Aircall secret token
5. Click **Save & Load Data**

## How "Meeting Booked" is detected

The app looks for Aircall **tags** on calls containing these keywords:
`meeting`, `booked`, `scheduled`, `demo`

Make sure your team tags calls with one of these when a meeting is set.
You can edit the keyword list in `index.html` — search for `MEETING_KEYWORDS`.

## Deploying (optional)

To run this on a server so your whole team can access it:

1. Upload both files to a server (Render, Railway, Heroku, etc.)
2. Set `PORT` environment variable if needed
3. Update `PROXY_BASE` in `index.html` to point to your server URL

## Files

- `server.js` — Node.js proxy server (no dependencies needed)
- `index.html` — Frontend app (served by the proxy)
- `package.json` — Project metadata
