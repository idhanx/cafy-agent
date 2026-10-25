# Where things are

The project root holds about 160 scripts. They are not moved into folders on purpose: the web app, the `package.json` commands, the tests and the Vercel setup all refer to them by path. This is the map, grouped by what they do.

Folders: `providers/` (130 connectors, one per job-board site — the scraping workhorses), `modes/` (AI instructions), `templates/` (CV and report templates), `lib/` (shared helpers), `web/` (the website).

## Scraping & job discovery (finding jobs on the web)

`archive-posting.mjs`, `ats-vendor.mjs`, `branded-successfactors.mjs`, `browser-extract.mjs`, `company-funded.mjs`, `discover-ats.mjs`, `discover-new-companies.mjs`, `fetch-jd.mjs`, `find.mjs`, `history-ats-seeds.mjs`, `scan-ats-full.mjs`, `scan-dayforce.mjs`, `scan-hn.mjs`, `scan-interamt.mjs`, `scan.mjs`

## Is a posting still open? / board health

`audit-portals.mjs`, `check-liveness.mjs`, `coverage-check.mjs`, `dead-boards.mjs`, `detect-reposts.mjs`, `liveness-api.mjs`, `liveness-browser.mjs`, `liveness-core.mjs`, `portal-health-lock.mjs`, `validate-portals.mjs`, `verify-portals.mjs`

## Tracker & pipeline (your applications list)

`analyze-patterns.mjs`, `calibrate.mjs`, `closing-soon.mjs`, `dedup-tracker.mjs`, `fix-report-links.mjs`, `fix-slugs.mjs`, `funnel-stages.mjs`, `funnel-velocity.mjs`, `merge-tracker.mjs`, `normalize-statuses.mjs`, `outcome.mjs`, `persist-evaluation-report.mjs`, `pipeline-lock.mjs`, `precheck-duplicate.mjs`, `process-quality.mjs`, `rank-pipeline.mjs`, `reconcile-pipeline.mjs`, `reeval-candidates.mjs`, `rejection-latency.mjs`, `reserve-report-num.mjs`, `session-activity.mjs`, `set-status.mjs`, `skip-blockers.mjs`, `stats.mjs`, `sync-batch-input.mjs`, `sync-pdf-flags.mjs`, `tracker-links.mjs`, `tracker-parse.mjs`, `tracker-sync-check.mjs`, `tracker-utils.mjs`, `tracker.mjs`, `upskill.mjs`, `verify-pipeline.mjs`

## CV, PDF & cover letters

`add-entry.mjs`, `application-answers.mjs`, `application-artifacts.mjs`, `ats-payload.mjs`, `batch-tailor.mjs`, `build-cv-html.mjs`, `build-cv-latex.mjs`, `career-profile.mjs`, `cv-experience-order.mjs`, `cv-sections-core.mjs`, `cv-sync-check.mjs`, `cv-templates.mjs`, `cv-title-check.mjs`, `extract-latex-content.mjs`, `generate-cover-letter.mjs`, `generate-latex.mjs`, `generate-pdf.mjs`, `img-to-pdf.mjs`, `install-latex-engine.mjs`, `jsonc-parse.mjs`, `mark-pdf-ready.mjs`, `match-star.mjs`, `openai-tailor.mjs`, `patch-latex-content.mjs`, `prepare-application.mjs`, `theme-style.mjs`, `verify-ats.mjs`, `verify-cv-facts.mjs`, `verify-cv-structure.mjs`

## Interviews, follow-ups & replies

`agent-inbox.mjs`, `assessment-log.mjs`, `contact-extract.mjs`, `contact-lookup.mjs`, `contacts.mjs`, `debrief-sync.mjs`, `followup-cadence.mjs`, `followup-seed.mjs`, `hired-share.mjs`, `hired-wall-build.mjs`, `ics-interview.mjs`, `invite-match.mjs`, `learn.mjs`, `linkedin-join.mjs`, `negotiation-roi.mjs`, `paste-reply.mjs`, `reply-matcher.mjs`, `reply-watch.mjs`, `salary-gap.mjs`, `story-provenance-check.mjs`, `weekly-digest.mjs`

## AI evaluation helpers

`batch-evaluate-gemini.mjs`, `classify-tier.mjs`, `eval-golden.mjs`, `evaluation-cache.mjs`, `gemini-eval.mjs`, `groq-lite-eval.mjs`, `intake.mjs`, `jd-capture.mjs`, `jd-similarity.mjs`, `jd-skill-gap.mjs`, `keyword-match.mjs`, `ollama-eval.mjs`, `onboard-write.mjs`, `openai-eval.mjs`, `openrouter-runner.mjs`, `profile-language.mjs`, `role-matcher.mjs`, `skill-extract.mjs`

## Setup, updates, plugins & repo upkeep

`build-dashboard.mjs`, `clean-markers.mjs`, `doctor.mjs`, `fingerprint-core.mjs`, `i18n-drift.mjs`, `listing-fingerprint.mjs`, `manifesto.mjs`, `migrate-scan-runs.mjs`, `path-resolver.mjs`, `playwright.cv.config.mjs`, `plugin-audit.mjs`, `plugin-install.mjs`, `plugins.mjs`, `remember-cli.mjs`, `seed-fixture.mjs`, `test-all.mjs`, `title-keywords.mjs`, `update-system.mjs`, `updater-migration-tests.mjs`, `upgrade-tests.mjs`, `url-key.mjs`, `user-agent.mjs`, `validate-plugin-registry.mjs`, `validate-profile.mjs`, `validate-system-paths-coverage.mjs`, `validate-untrusted-content-coverage.mjs`

## Everything else

`apply-scope.mjs`, `check-jd-archive.mjs`, `check-table-freshness.mjs`, `company-history.mjs`, `discard-analytics.mjs`, `filter-audit.mjs`, `github-evidence.mjs`
