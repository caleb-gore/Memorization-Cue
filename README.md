# Memorization Cue

Static web app for:
- text-to-cue formatting
- script cue generation by character
- local flashcard practice in the browser

## Run Locally

Open [index.html](./index.html) in a browser.

## Deploy To GitHub Pages

1. Create a new GitHub repository.
2. Add these files to the repository root:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `README.md`
3. Push the repository to GitHub.
4. In GitHub, open the repository settings.
5. Go to `Pages`.
6. Under `Build and deployment`, set:
   - `Source`: `Deploy from a branch`
   - `Branch`: `main`
   - `Folder`: `/ (root)`
7. Save.
8. Wait for GitHub Pages to publish the site.

Your site will be available at:

```text
https://<your-github-username>.github.io/<repo-name>/
```

## Notes

- The app is fully client-side. No backend is required.
- Saved state uses browser storage on the current device and browser only.
- Data saved on desktop will not automatically appear on phone.
- If you change storage or flashcard logic later, older saved browser state may be reset by app version changes.
