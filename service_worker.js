// One-Click Share to X (MV3)
// Core: action click -> open X intent with generated text
// Options: template + fixed hashtags + language UI (options page)

const SETTINGS_KEY = "settings";

const DEFAULT_SETTINGS = {
  languageChoice: "system",   // "system" | "en" | "ja" | ...
  template: "{title}\n{url}",
  hashtags: ""
};

async function getSettings() {
  const res = await chrome.storage.sync.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(res[SETTINGS_KEY] || {}) };
}

function normalizeTemplateNewlines(s) {
  if (!s) return "";
  // Convert literal "\n" (backslash + n) and "/n" to real newlines
  return s.replace(/\\n/g, "\n").replace(/\/n/g, "\n");
}

function buildPostText({ title, url }, settings) {
  const templateRaw = settings.template || DEFAULT_SETTINGS.template;
  const template = normalizeTemplateNewlines(templateRaw);

  const hashtags = (settings.hashtags || "").trim();
  const hasHashtagsToken = template.includes("{hashtags}");

  let text = template
    .replaceAll("{title}", title || "")
    .replaceAll("{url}", url || "")
    .replaceAll("{hashtags}", hashtags);

  if (!hasHashtagsToken && hashtags) {
    text = text.replace(/\s+$/g, "");
    if (text.length) text += "\n";
    text += hashtags;
  }

  // Trim trailing whitespace/newlines (keep internal formatting)
  text = text.replace(/[ \t]+\n/g, "\n").replace(/\s+$/g, "");
  return text;
}

function isSharableUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return !(
    lower.startsWith("chrome://") ||
    lower.startsWith("chrome-extension://") ||
    lower.startsWith("edge://") ||
    lower.startsWith("about:")
  );
}

async function openXIntent(text) {
  const intentUrl = "https://x.com/intent/post?text=" + encodeURIComponent(text);
  await chrome.tabs.create({ url: intentUrl });
}

chrome.action.onClicked.addListener(async (tab) => {
  try {
    const settings = await getSettings();
    const title = tab?.title ?? "";
    const url = tab?.url ?? "";

    if (!isSharableUrl(url)) return;

    const text = buildPostText({ title, url }, settings);
    await openXIntent(text);
  } catch (e) {
    console.error(e);
  }
});
