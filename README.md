# One-Click Share to X

A lightweight Chrome extension that opens X’s post composer with the **current tab’s title and URL** — in **one click**.

- ✅ Open Source
- ✅ No X API / no authentication
- ✅ Works out of the box (no setup required)
- ✅ Customizable template + fixed hashtags
- ✅ **Domain/Path-specific templates** — customize templates per website (e.g., youtube.com/watch vs google.com)
- ✅ Options UI supports **System / English / Japanese** (extensible)

## How it works

When you click the extension icon, it reads the active tab’s:

- `title`
- `url`

…generates text from your template, then opens:

- `https://x.com/intent/post?text=...`

You can edit the text in X’s composer and post normally.

## Install (Chrome Web Store)

- Chrome Web Store: https://chromewebstore.google.com/detail/lhllhjnpcnbomhkabcindkjchkknjnij

## Install (Manual / Developer Mode)

1. Download and unzip the extension folder.
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (top right).
4. Click **Load unpacked**.
5. Select the unzipped extension folder.

## Usage

1. Open any normal web page (http/https).
2. Click the extension icon.
3. X’s post composer opens with prefilled text.

> Note: Pages like `chrome://...` or `chrome-extension://...` cannot be shared due to Chrome restrictions.

## Options

Open the options page from Chrome’s extensions UI:

- `chrome://extensions/` → **One-Click Share to X** → **Details** → **Extension options**

### Template

The template is a **multi-line** text box. You can use these placeholders:

- `{title}` — current tab title
- `{url}` — current tab URL
- `{hashtags}` — fixed hashtags (see below)

**Newlines**
- Actual line breaks (press Enter) work
- The following sequences are also converted to newlines:
  - `\n`
  - `/n`

**Examples**
```text
{title}
{url}
```

```text
{title}\n{url}\n#music #bookmark
```

```text
Listening: {title}
{url}
```

### Fixed hashtags (optional)

- If your template contains `{hashtags}`, the extension inserts your fixed hashtags there.
- If your template does **not** contain `{hashtags}`, the extension appends the hashtags to the end (on a new line).

### Domain/Path Templates

You can create different templates for specific domains or even specific paths within a domain. This is useful when you want different posting formats for different websites.

**Priority Order** (highest to lowest):

1. **Full domain + path match** — `youtube.com/watch` matches exactly `youtube.com/watch`
2. **Path prefix match** — `youtube.com/watch` matches `youtube.com/watch?v=xxx`
3. **Exact domain match** — `mail.google.com`
4. **Parent domain fallback** — `google.com` matches `mail.google.com` or `drive.google.com`
5. **Default template** — used when no specific template matches

**How to use:**

1. Open the Options page
2. Click **"Add Domain/Path"**
3. Enter a domain (e.g., `youtube.com`) or domain+path (e.g., `youtube.com/watch`)
4. Customize the template for that specific site
5. Save your settings

**Examples:**

```
Template registrations:
- youtube.com/watch      → "Watching: {title}"
- youtube.com            → "YouTube: {title}"
- mail.google.com        → "Gmail: {title}"
- google.com             → "Google: {title}"

Behavior:
- youtube.com/watch?v=xxx     → "Watching: ..." (exact path match)
- youtube.com/shorts/xxx      → "YouTube: ..."  (no path match, uses parent domain)
- mail.google.com/inbox       → "Gmail: ..."    (exact domain match)
- drive.google.com            → "Google: ..."   (parent domain fallback)
```

## Language (System / English / Japanese)

The options page lets you choose its UI language:

- **System** (follows your Chrome UI language)
- **English**
- **日本語**

Language names in the dropdown are displayed in their **own language** (e.g., “English”, “日本語”, “français”), using `Intl.DisplayNames`.

## Adding more languages

Chrome extensions use JSON-based locale files under `_locales/`.

1. Create a new locale folder, e.g.:
   - `_locales/fr/messages.json`
2. Add the same message keys as existing locales (`en`, `ja`).
3. Register the locale code in:
   - `locales/index.json`

Example:
```json
{ "supported": ["en", "ja", "fr"] }
```

That’s it — the new language will appear in the language dropdown automatically.

## Permissions

This extension uses:

- `activeTab` — read the active tab’s title and URL when you click the icon
- `storage` — save options (template, hashtags, UI language choice, domain/path-specific templates)

No external servers are used.

## Privacy

- The extension does **not** collect analytics.
- The extension does **not** send your browsing data anywhere.
- It only opens X’s official “intent” URL in a new tab.

## Project structure (overview)

```text
.
├─ manifest.json
├─ service_worker.js
├─ options.html
├─ options.js
├─ options.css
├─ locales/
│  └─ index.json
├─ _locales/
│  ├─ en/messages.json
│  └─ ja/messages.json
└─ icons/
   ├─ icon16.png
   ├─ icon48.png
   └─ icon128.png
```

## Credits

むしにゃんこ（Mush1to）
- X：https://x.com/Mush1to
- Donate：https://streamlabs.com/mush1to/tip
