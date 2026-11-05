# Nice to Know Studio

A personal script-building app for the **@missniceph – Nice to Know** Reels channel.
Plan ideas, write and time scripts, fact-check claims, plan shots, read from a teleprompter, and get captions ready for every platform.

- No login, no backend, no AI, no paid services.
- Works on your phone and laptop browser.
- Everything is saved **in your browser on that device**. Use **Settings → Export backup** often, and **Import backup** to restore or move your work to another device.

## Put it online for free (GitHub Pages)

1. Open this repository on GitHub.
2. Go to **Settings → Pages** (left sidebar).
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Under **Branch**, pick **main** (or whichever branch has these files) and the **/ (root)** folder, then click **Save**.
5. Wait 1–2 minutes, then refresh the page. GitHub shows your link at the top, usually:
   `https://<your-github-username>.github.io/nice-to-know-studio/`
6. Open that link on your phone and use **Add to Home Screen** (Safari: Share button; Chrome: ⋮ menu) so it opens like an app.

> Note: GitHub Pages on a free account needs the repository to be **public**. Your ideas and scripts are *not* in the repository — they live only in your browser — so making the code public does not expose your work.

## Important: about your data

- Data is stored per browser and per device. Your phone and laptop do **not** sync automatically.
- To move work: **Export backup** on one device → send the `.json` file to yourself (Drive, email, Messenger) → **Import backup** on the other device. Import **replaces** what's there.
- Clearing your browser's site data/history can erase the app's data. Export a backup first.

## Using it locally (optional)

Just double-click `index.html` to open it in a browser. No install needed.

## What's here and how to update it

Your live app: **https://missniceph.github.io/nice-to-know-studio/**

| File | What it is |
| --- | --- |
| `index.html` | The page itself, plus the title, description and link-preview settings |
| `styles.css` | The look: colours, light and dark mode, phone layout |
| `app.js` | Everything the app does, including the sample idea and the default caption limits |
| `og-image.png` | The picture shown when you share the link (1200 × 630) |
| `og-image.svg` | The editable source of that picture |
| `favicon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | Browser-tab and home-screen icons |
| `manifest.webmanifest` | Lets phones install it from **Add to Home Screen** |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are |

**To change something:**

1. On GitHub, open the file and click the ✏️ pencil icon. Make your change, then click **Commit changes** to save it to `main`.
2. Wait 1–2 minutes and the live app updates by itself. On your phone, close and reopen the app to see it.
3. Your saved ideas and scripts are not affected. They live in your browser, not in these files.

**Common edits:**

- **Caption limits.** Change them in the app under **Settings → Caption limits**; no code needed. To change the starting values for new devices, edit `DEFAULT_LIMITS` near the top of `app.js`.
- **Speaking speed.** Change it in **Settings → Speaking speed**.
- **Share text.** Edit the `description` and `og:` lines near the top of `index.html`.
- **Share picture.** Edit `og-image.svg` and export it as a 1200 × 630 PNG named `og-image.png`. Facebook and Messenger don't accept SVG previews. Facebook keeps old previews for a while; paste your link into the [Sharing Debugger](https://developers.facebook.com/tools/debug/) and click **Scrape Again** to refresh it.
- **If your link ever changes** (for example, a renamed repository or a custom domain): update the full web addresses in `index.html` (the `canonical`, `og:url` and `og:image` lines).
