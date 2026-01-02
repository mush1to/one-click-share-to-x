const SETTINGS_KEY = "settings";

const DEFAULT_SETTINGS = {
  languageChoice: "system", // "system" | "en" | "ja" | ...
  template: "{title}\n{url}",
  hashtags: ""
};

const SAMPLE = {
  title: "Example Title",
  url: "https://example.com"
};

async function getSettings() {
  const res = await chrome.storage.sync.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(res[SETTINGS_KEY] || {}) };
}

async function saveSettings(settings) {
  await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
}

async function loadSupportedLocales() {
  const url = chrome.runtime.getURL("locales/index.json");
  const res = await fetch(url);
  if (!res.ok) return ["en", "ja"];
  const data = await res.json();
  return Array.isArray(data.supported) ? data.supported : ["en", "ja"];
}

function languageSelfName(locale) {
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(locale) || locale;
  } catch {
    return locale;
  }
}

async function loadLocaleMessages(locale) {
  const url = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Missing locale: " + locale);
  return await res.json(); // { key: {message: "..."} }
}

function tFromDict(dict, key) {
  return dict?.[key]?.message ?? `__MISSING:${key}__`;
}

function normalizeTemplateNewlines(s) {
  if (!s) return "";
  return s.replace(/\\n/g, "\n").replace(/\/n/g, "\n");
}

function buildPostText(settings) {
  const templateRaw = settings.template || DEFAULT_SETTINGS.template;
  const template = normalizeTemplateNewlines(templateRaw);

  const hashtags = (settings.hashtags || "").trim();
  const hasHashtagsToken = template.includes("{hashtags}");

  let text = template
    .replaceAll("{title}", SAMPLE.title)
    .replaceAll("{url}", SAMPLE.url)
    .replaceAll("{hashtags}", hashtags);

  if (!hasHashtagsToken && hashtags) {
    text = text.replace(/\s+$/g, "");
    if (text.length) text += "\n";
    text += hashtags;
  }

  return text.replace(/[ \t]+\n/g, "\n").replace(/\s+$/g, "");
}

function byId(id) { return document.getElementById(id); }

async function applyI18n(settings) {
  const choice = settings.languageChoice || "system";

  let dict = null;
  if (choice !== "system") {
    dict = await loadLocaleMessages(choice);
  }

  const nodes = document.querySelectorAll("[data-i18n]");
  for (const el of nodes) {
    const key = el.getAttribute("data-i18n");
    const msg = (choice === "system")
      ? chrome.i18n.getMessage(key)
      : tFromDict(dict, key);

    if (msg) el.textContent = msg;
  }

  const titleKey = "optionsTitle";
  document.title = (choice === "system")
    ? (chrome.i18n.getMessage(titleKey) || "Options")
    : tFromDict(dict, titleKey);

  const examples = (choice === "system")
    ? chrome.i18n.getMessage("templateExamples")
    : tFromDict(dict, "templateExamples");

  byId("templateExamples").textContent =
    examples || "{title}\\n{url}\n{title}\\n{url}\\n#music #bookmark\nListening: {title}\\n{url}";
}

async function populateLanguageSelect(settings) {
  const select = byId("language");
  const supported = await loadSupportedLocales();

  select.innerHTML = "";
  select.append(new Option("System", "system"));
  for (const lc of supported) {
    select.append(new Option(languageSelfName(lc), lc));
  }

  select.value = settings.languageChoice || "system";
}

function setStatus(text) {
  const el = byId("status");
  el.textContent = text || "";
  if (!text) return;
  window.clearTimeout(setStatus._t);
  setStatus._t = window.setTimeout(() => { el.textContent = ""; }, 1800);
}

async function main() {
  const settings = await getSettings();

  await populateLanguageSelect(settings);
  await applyI18n(settings);

  byId("template").value = settings.template || DEFAULT_SETTINGS.template;
  byId("hashtags").value = settings.hashtags || "";

  byId("preview").value = buildPostText(settings);

  const refreshPreview = async () => {
    const cur = await getSettings();
    cur.template = byId("template").value;
    cur.hashtags = byId("hashtags").value;
    byId("preview").value = buildPostText(cur);
  };

  byId("template").addEventListener("input", refreshPreview);
  byId("hashtags").addEventListener("input", refreshPreview);

  byId("language").addEventListener("change", async () => {
    const cur = await getSettings();
    cur.languageChoice = byId("language").value;
    await saveSettings(cur);
    await applyI18n(cur);
    setStatus(chrome.i18n.getMessage("saved") || "Saved");
  });

  byId("save").addEventListener("click", async () => {
    const cur = await getSettings();
    cur.template = byId("template").value;
    cur.hashtags = byId("hashtags").value;
    cur.languageChoice = byId("language").value;

    await saveSettings(cur);
    byId("preview").value = buildPostText(cur);
    setStatus(chrome.i18n.getMessage("saved") || "Saved");
  });

  byId("reset").addEventListener("click", async () => {
    const cur = await getSettings();
    cur.template = DEFAULT_SETTINGS.template;
    cur.hashtags = "";
    await saveSettings(cur);
    byId("template").value = cur.template;
    byId("hashtags").value = cur.hashtags;
    byId("preview").value = buildPostText(cur);
    setStatus(chrome.i18n.getMessage("resetDone") || "Reset");
  });
}

main().catch(console.error);
