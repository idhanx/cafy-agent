# Deploying Cafy Agent on Vercel

One deployment serves **one client**: a private, password-protected copy with its own
storage. The client only has to connect an AI provider (an OpenRouter API key).

## What you need

| | |
|---|---|
| Vercel plan | **Pro** (or higher). Several routes run for up to 5–13 minutes (`maxDuration` 300–800 s), which Hobby does not allow. |
| Blob store | A **private** Vercel Blob store (holds the client's CV, tracker, reports). |
| AI key | An OpenRouter key — set by you, or pasted by the client in *Settings → AI provider*. |

## Deploy

1. Push this repository to GitHub (personal files are git-ignored, so none are pushed).
2. In Vercel: **Add New → Project**, import the repo, and set **Root Directory = `web`**.
   Keep **"Include source files outside of the Root Directory"** switched **on** (the app runs
   the engine scripts that live one folder up).
3. **Storage → Create → Blob → _Private_**, connect it to the project. This adds `BLOB_READ_WRITE_TOKEN`.
4. **Settings → Environment Variables**, add (see `web/.env.example`):
   - `CAFY_APP_PASSWORD` — the password you give the client
   - `AUTH_SECRET` — a long random string (`openssl rand -base64 32`)
   - optional: `OPENROUTER_API_KEY` (otherwise the client pastes theirs in Settings)
5. Deploy. The function region is London (`lhr1`) via `web/vercel.json`; create the Blob store in a
   nearby region too.

**Deploy from the Vercel dashboard (Git import), not with `vercel` from the repository root.** The repo also holds a Go
terminal dashboard in `dashboard/`. The CLI, run from the root, mistakes it for a separate "service" and stops with
`MISSING_SERVICE_CONFIG … Service "dashboard" must specify an "entrypoint" for runtime "go"`. With Root Directory set to
`web` (step 2) Vercel never looks at that folder.

## Check it before the client does

Open the deployment URL and go through this list:

1. You land on the **sign-in** page; a wrong password is refused; the right one gets you in.
2. No amber banner at the top. If one appears it names what is missing (storage, AI provider, engine files).
3. **Settings → Connect an AI key** → paste the key → "Connected". Pick a model if you want a different one.
4. **Résumé** → add a CV. Reload the page, then open the site in a private window and sign in again: the CV is still there.
5. **Find jobs** → set roles, keep UK + Ireland → search. Results stream in (about a minute).
6. Open a result → **Evaluate**. A report appears and the job shows up under **My applications**.
7. On a report, **Generate PDF**. If this fails, the message says why; the tailored CV is still saved as HTML.

## What differs from the desktop version

- **Scheduled scans** and **guided apply** (which opens a visible browser) need the user's own computer and
  are switched off here. Each application's checklist (tailored CV, copy-paste answers) works as normal.
- Your AI runs through OpenRouter; locally-installed AI tools (Claude Code, Codex…) are not used.
- Data lives in the Blob store, not on a disk. After a change, it is saved when the request finishes.
  If you open the site in two places at once, the last save wins.

## Costs & limits worth knowing

- Every AI action (evaluate, CV tailoring, assistant, AI search) uses the client's OpenRouter credit. Job
  discovery (Find jobs) uses none.
- PDF rendering uses a serverless Chromium (`@sparticuz/chromium`) that is unpacked on first use (a few seconds).
