const SETTINGS_KEY = "settings";

const DEFAULT_SETTINGS = {
  languageChoice: "system", // "system" | "en" | "ja" | ...
  template: "{title}\n{url}",
  hashtags: "",
  domainTemplates: {} // { "example.com": "template", "example.com/path": "template", ... }
};

const SAMPLE_DEFAULT = {
  title: "Example Title",
  url: "https://example.com"
};

// Current editing state
let currentKey = ""; // "" means default template, otherwise "domain.com" or "domain.com/path"
let unsavedDomainTemplates = {}; // Store unsaved changes
let settingsCache = null; // Cache for current settings

async function getSettings() {
  if (settingsCache) return settingsCache;
  const res = await chrome.storage.sync.get(SETTINGS_KEY);
  settingsCache = { ...DEFAULT_SETTINGS, ...(res[SETTINGS_KEY] || {}) };
  return settingsCache;
}

async function saveSettings(settings) {
  await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
  settingsCache = { ...settings };
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
  return await res.json();
}

function tFromDict(dict, key) {
  return dict?.[key]?.message ?? `__MISSING:${key}__`;
}

function normalizeTemplateNewlines(s) {
  if (!s) return "";
  return s.replace(/\\n/g, "\n").replace(/\/n/g, "\n");
}

function getTemplateForKey(settings, key) {
  if (!key) return settings.template || DEFAULT_SETTINGS.template;
  
  // Check unsaved changes first
  if (unsavedDomainTemplates.hasOwnProperty(key)) {
    return unsavedDomainTemplates[key];
  }
  
  // Check saved templates
  if (settings.domainTemplates && settings.domainTemplates[key]) {
    return settings.domainTemplates[key];
  }
  
  return settings.template || DEFAULT_SETTINGS.template;
}

function getTemplateForUrl(settings, url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname;
    
    const templates = { ...settings.domainTemplates, ...unsavedDomainTemplates };
    
    // Priority 1: Full match (hostname + pathname)
    const fullPath = hostname + pathname;
    if (templates[fullPath]) {
      return templates[fullPath];
    }
    
    // Priority 2: Pathname prefix matches
    const pathKeys = Object.keys(templates)
      .filter(key => key.startsWith(hostname + '/') && pathname.startsWith(key.substring(hostname.length)))
      .sort((a, b) => b.length - a.length);
    
    if (pathKeys.length > 0) {
      return templates[pathKeys[0]];
    }
    
    // Priority 3: Exact hostname match
    if (templates[hostname]) {
      return templates[hostname];
    }
    
    // Priority 4: Parent domain match
    const parts = hostname.split('.');
    if (parts.length > 2) {
      const parentDomain = parts.slice(-2).join('.');
      if (templates[parentDomain]) {
        return templates[parentDomain];
      }
    }
    
    return settings.template || DEFAULT_SETTINGS.template;
  } catch {
    return settings.template || DEFAULT_SETTINGS.template;
  }
}

function buildPostText(settings, keyOrUrl) {
  let templateRaw;
  
  if (!keyOrUrl || keyOrUrl === currentKey) {
    // Use current editing key
    templateRaw = getTemplateForKey(settings, currentKey);
  } else if (keyOrUrl.startsWith('http')) {
    // It's a URL
    templateRaw = getTemplateForUrl(settings, keyOrUrl);
  } else {
    // It's a key
    templateRaw = getTemplateForKey(settings, keyOrUrl);
  }
  
  const template = normalizeTemplateNewlines(templateRaw);
  const hashtags = (settings.hashtags || "").trim();
  const hasHashtagsToken = template.includes("{hashtags}");

  // Use preview URL for preview, or extract from key
  let sampleTitle = SAMPLE_DEFAULT.title;
  let sampleUrl = SAMPLE_DEFAULT.url;
  
  const previewUrlInput = byId("previewUrl");
  if (previewUrlInput && previewUrlInput.value) {
    sampleUrl = previewUrlInput.value;
    try {
      const urlObj = new URL(sampleUrl);
      sampleTitle = `Page on ${urlObj.hostname}`;
    } catch {
      sampleTitle = "Page Title";
    }
  } else if (currentKey) {
    // Try to construct URL from key
    if (currentKey.includes('/')) {
      sampleUrl = `https://${currentKey}`;
    } else {
      sampleUrl = `https://${currentKey}/page`;
    }
    sampleTitle = `Page on ${currentKey.split('/')[0]}`;
  }

  let text = template
    .replaceAll("{title}", sampleTitle)
    .replaceAll("{url}", sampleUrl)
    .replaceAll("{hashtags}", hashtags);

  if (!hasHashtagsToken && hashtags) {
    text = text.replace(/\s+$/g, "");
    if (text.length) text += "\n";
    text += hashtags;
  }

  return text.replace(/[ \t]+\n/g, "\n").replace(/\s+$/g, "");
}

function byId(id) { return document.getElementById(id); }

function getDisplayNameForKey(key) {
  if (!key) {
    return chrome.i18n.getMessage("defaultTemplateOption") || "Default (All domains)";
  }
  
  // If key has path, show it clearly
  if (key.includes('/')) {
    return key;
  }
  
  return key;
}

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

function populateDomainSelect(settings) {
  const select = byId("domainSelect");
  
  // Save current selection
  const previousValue = select.value;
  
  // Clear and rebuild options
  select.innerHTML = "";
  const defaultOptionLabel = chrome.i18n.getMessage("defaultTemplateOption") || "Default (All domains)";
  select.append(new Option(defaultOptionLabel, ""));
  
  // Collect all keys (saved + unsaved)
  const allKeys = new Set();
  Object.keys(settings.domainTemplates || {}).forEach(k => allKeys.add(k));
  Object.keys(unsavedDomainTemplates).forEach(k => allKeys.add(k));
  
  // Sort keys: domain-only first, then with paths
  const sortedKeys = Array.from(allKeys).sort((a, b) => {
    const aHasPath = a.includes('/');
    const bHasPath = b.includes('/');
    if (aHasPath !== bHasPath) return aHasPath ? 1 : -1;
    return a.localeCompare(b);
  });
  
  for (const key of sortedKeys) {
    const displayName = getDisplayNameForKey(key);
    const isUnsaved = unsavedDomainTemplates.hasOwnProperty(key) && !settings.domainTemplates?.[key];
    const optionText = isUnsaved ? `${displayName} (unsaved)` : displayName;
    select.append(new Option(optionText, key));
  }
  
  // Restore selection or use currentKey
  if (currentKey && Array.from(select.options).some(opt => opt.value === currentKey)) {
    select.value = currentKey;
  } else if (previousValue && Array.from(select.options).some(opt => opt.value === previousValue)) {
    select.value = previousValue;
    currentKey = previousValue;
  } else {
    select.value = "";
    currentKey = "";
  }
  
  updateRemoveButtonVisibility();
}

function updateRemoveButtonVisibility() {
  const removeBtn = byId("removeDomainBtn");
  if (currentKey) {
    removeBtn.style.display = "inline-block";
  } else {
    removeBtn.style.display = "none";
  }
}

function setStatus(text) {
  const el = byId("status");
  el.textContent = text || "";
  if (!text) return;
  window.clearTimeout(setStatus._t);
  setStatus._t = window.setTimeout(() => { el.textContent = ""; }, 1800);
}

function parseDomainInput(input) {
  // Remove protocol if present
  let cleanInput = input.trim().replace(/^https?:\/\//, '');
  
  // Remove query string and hash
  cleanInput = cleanInput.split('?')[0].split('#')[0];
  
  // Validate format
  // Accept: domain.com, domain.com/path, sub.domain.com, sub.domain.com/path
  const parts = cleanInput.split('/');
  const domainPart = parts[0];
  const pathPart = parts.length > 1 ? '/' + parts.slice(1).join('/') : '';
  
  // Domain validation
  const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*)+$/;
  if (!domainPattern.test(domainPart)) {
    return null;
  }
  
  // Path validation (should start with / and contain valid characters)
  if (pathPart && !pathPart.match(/^\/[a-zA-Z0-9_\-\/.]*$/)) {
    return null;
  }
  
  return pathPart ? domainPart + pathPart : domainPart;
}

async function main() {
  const settings = await getSettings();
  
  // Initialize unsaved domain templates with saved ones
  unsavedDomainTemplates = { ...(settings.domainTemplates || {}) };

  await populateLanguageSelect(settings);
  await applyI18n(settings);
  populateDomainSelect(settings);

  // Set initial values
  byId("template").value = settings.template || DEFAULT_SETTINGS.template;
  byId("hashtags").value = settings.hashtags || "";
  byId("previewUrl").value = SAMPLE_DEFAULT.url;
  byId("preview").value = buildPostText(settings, currentKey);

  // Domain selection change handler
  byId("domainSelect").addEventListener("change", async () => {
    const select = byId("domainSelect");
    currentKey = select.value;
    
    // Get template for selected key
    const template = getTemplateForKey(settings, currentKey);
    byId("template").value = template;
    
    // Update preview URL based on selection
    if (currentKey) {
      if (currentKey.includes('/')) {
        byId("previewUrl").value = `https://${currentKey}`;
      } else {
        byId("previewUrl").value = `https://${currentKey}/sample-page`;
      }
    } else {
      byId("previewUrl").value = SAMPLE_DEFAULT.url;
    }
    
    // Update preview
    byId("preview").value = buildPostText(settings, currentKey);
    
    updateRemoveButtonVisibility();
  });

  // Add domain button handler
  byId("addDomainBtn").addEventListener("click", async () => {
    const promptMsg = chrome.i18n.getMessage("addDomainPrompt") || 
      "Enter domain or domain+path (e.g., example.com, mail.google.com, youtube.com/watch):";
    const input = prompt(promptMsg);
    if (!input) return;
    
    const key = parseDomainInput(input);
    if (!key) {
      const errorMsg = chrome.i18n.getMessage("invalidDomain") || 
        "Invalid format. Use: example.com or example.com/path";
      alert(errorMsg);
      return;
    }
    
    // Add to unsaved domain templates with current template value
    const currentTemplate = byId("template").value;
    unsavedDomainTemplates[key] = currentTemplate;
    
    // Update select and select the new key
    populateDomainSelect(settings);
    byId("domainSelect").value = key;
    currentKey = key;
    
    // Update preview URL
    if (key.includes('/')) {
      byId("previewUrl").value = `https://${key}`;
    } else {
      byId("previewUrl").value = `https://${key}/sample-page`;
    }
    
    updateRemoveButtonVisibility();
    const successMsg = chrome.i18n.getMessage("domainAdded") || "Domain/Path added (save to apply)";
    setStatus(successMsg);
  });

  // Remove domain button handler
  byId("removeDomainBtn").addEventListener("click", async () => {
    if (!currentKey) return;
    
    const confirmKey = chrome.i18n.getMessage("removeDomainConfirm") || "Remove template for";
    if (!confirm(`${confirmKey} "${currentKey}"?`)) return;
    
    // Remove from unsaved templates
    delete unsavedDomainTemplates[currentKey];
    
    // Also remove from settings cache to immediately update the dropdown
    if (settings.domainTemplates && settings.domainTemplates[currentKey]) {
      delete settings.domainTemplates[currentKey];
    }
    
    // Update select and switch to default
    populateDomainSelect(settings);
    byId("domainSelect").value = "";
    currentKey = "";
    
    // Reset template to default
    byId("template").value = settings.template || DEFAULT_SETTINGS.template;
    byId("previewUrl").value = SAMPLE_DEFAULT.url;
    byId("preview").value = buildPostText(settings, currentKey);
    
    updateRemoveButtonVisibility();
    const removedMsg = chrome.i18n.getMessage("domainRemoved") || "Domain/Path removed (save to apply)";
    setStatus(removedMsg);
  });

  // Template input handler
  byId("template").addEventListener("input", async () => {
    const template = byId("template").value;
    
    if (currentKey) {
      // Update unsaved domain template
      unsavedDomainTemplates[currentKey] = template;
    }
    
    // Update preview
    const cur = await getSettings();
    cur.domainTemplates = { ...cur.domainTemplates, ...unsavedDomainTemplates };
    byId("preview").value = buildPostText(cur, currentKey);
  });

  // Preview URL input handler
  byId("previewUrl").addEventListener("input", async () => {
    const cur = await getSettings();
    cur.domainTemplates = { ...cur.domainTemplates, ...unsavedDomainTemplates };
    byId("preview").value = buildPostText(cur, byId("previewUrl").value);
  });

  // Hashtags input handler
  byId("hashtags").addEventListener("input", async () => {
    const cur = await getSettings();
    cur.hashtags = byId("hashtags").value;
    cur.domainTemplates = { ...cur.domainTemplates, ...unsavedDomainTemplates };
    byId("preview").value = buildPostText(cur, byId("previewUrl").value);
  });

  // Language change handler
  byId("language").addEventListener("change", async () => {
    const cur = await getSettings();
    cur.languageChoice = byId("language").value;
    await saveSettings(cur);
    settings.languageChoice = cur.languageChoice;
    await applyI18n(cur);
    setStatus(chrome.i18n.getMessage("saved") || "Saved");
  });

  // Save button handler
  byId("save").addEventListener("click", async () => {
    const cur = await getSettings();
    
    // Merge unsaved templates
    cur.domainTemplates = { ...cur.domainTemplates, ...unsavedDomainTemplates };
    
    // If editing default, save the template
    if (!currentKey) {
      cur.template = byId("template").value;
    } else {
      // Ensure the current key's template is saved
      cur.domainTemplates[currentKey] = byId("template").value;
    }
    
    cur.hashtags = byId("hashtags").value;
    cur.languageChoice = byId("language").value;

    await saveSettings(cur);
    
    // Update settings reference
    Object.assign(settings, cur);
    
    // Refresh UI
    populateDomainSelect(settings);
    byId("preview").value = buildPostText(settings, byId("previewUrl").value);
    setStatus(chrome.i18n.getMessage("saved") || "Saved");
  });

  // Reset button handler
  byId("reset").addEventListener("click", async () => {
    const confirmMsg = chrome.i18n.getMessage("resetConfirm") || 
      "Reset all settings to default?\nThis will remove all domain/path-specific templates.";
    if (!confirm(confirmMsg)) return;
    
    const cur = await getSettings();
    cur.template = DEFAULT_SETTINGS.template;
    cur.hashtags = "";
    cur.domainTemplates = {};
    cur.languageChoice = "system";
    
    await saveSettings(cur);
    
    // Update settings reference
    Object.assign(settings, cur);
    settings.domainTemplates = {};
    
    // Reset editing state
    unsavedDomainTemplates = {};
    currentKey = "";
    
    // Update UI
    byId("template").value = cur.template;
    byId("hashtags").value = "";
    byId("language").value = "system";
    byId("previewUrl").value = SAMPLE_DEFAULT.url;
    populateDomainSelect(settings);
    await applyI18n(cur);
    byId("preview").value = buildPostText(cur, currentKey);
    updateRemoveButtonVisibility();
    setStatus(chrome.i18n.getMessage("resetDone") || "Reset");
  });
}

main().catch(console.error);
