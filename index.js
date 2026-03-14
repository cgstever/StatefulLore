/**

- Overwrite — SillyTavern Extension
- 
- A programmable lore engine that replaces ST’s lorebook with stateful,
- code-driven game logic.  Loads JS lore modules that implement
- processTurn() and handleResponse().  The extension handles ST integration,
- state persistence, and injection plumbing.  The lore module handles all
- game logic.
- 
- Cross-device sync: import a lore file once on any browser → it uploads to
- your ST server → every other browser/device on the same ST instance auto-
- loads it on next page load.  No manual steps required.
  */

// ── Constants ───────────────────────────────────────────────────────────────

const MODULE_NAME = ‘overwrite’;

const DEFAULTS = {
enabled: true,
active_lore: null,       // key into IndexedDB lore store
debug: false,
server_lores: {},        // { [key]: serverPath } — shared across all clients via ST settings
};

// ── Runtime state ───────────────────────────────────────────────────────────

let settings = {};
let db = null;
let activeLore = null;       // the loaded lore module object
let lastTurnResult = null;   // cached for handleResponse

// ── IndexedDB ───────────────────────────────────────────────────────────────

const DB_NAME = ‘overwrite’;
const DB_VERSION = 2;
const STORE_STATE = ‘session_state’;
const STORE_PERSONA = ‘persona_state’;
const STORE_LORE = ‘lore_modules’;   // stores imported .js lore source text

function openDB() {
return new Promise((resolve, reject) => {
const req = indexedDB.open(DB_NAME, DB_VERSION);
req.onupgradeneeded = (e) => {
const idb = e.target.result;
if (!idb.objectStoreNames.contains(STORE_STATE))
idb.createObjectStore(STORE_STATE, { keyPath: ‘id’ });
if (!idb.objectStoreNames.contains(STORE_PERSONA))
idb.createObjectStore(STORE_PERSONA, { keyPath: ‘id’ });
if (!idb.objectStoreNames.contains(STORE_LORE))
idb.createObjectStore(STORE_LORE, { keyPath: ‘id’ });
};
req.onsuccess = () => resolve(req.result);
req.onerror = () => reject(req.error);
});
}

function idbGet(store, key) {
return new Promise((resolve, reject) => {
const tx = db.transaction(store, ‘readonly’);
const req = tx.objectStore(store).get(key);
req.onsuccess = () => resolve(req.result?.data ?? null);
req.onerror = () => reject(req.error);
});
}

function idbPut(store, key, data) {
return new Promise((resolve, reject) => {
const tx = db.transaction(store, ‘readwrite’);
const req = tx.objectStore(store).put({ id: key, data });
req.onsuccess = () => resolve();
req.onerror = () => reject(req.error);
});
}

function idbDelete(store, key) {
return new Promise((resolve, reject) => {
const tx = db.transaction(store, ‘readwrite’);
const req = tx.objectStore(store).delete(key);
req.onsuccess = () => resolve();
req.onerror = () => reject(req.error);
});
}

function idbGetAll(store) {
return new Promise((resolve, reject) => {
const tx = db.transaction(store, ‘readonly’);
const req = tx.objectStore(store).getAll();
req.onsuccess = () => resolve(req.result || []);
req.onerror = () => reject(req.error);
});
}

// ── Keys ────────────────────────────────────────────────────────────────────

function getSessionKey() {
const ctx = SillyTavern.getContext();
const chatId = ctx.getCurrentChatId?.() || ‘unknown’;
const charName = ctx.characters?.[ctx.characterId]?.name || ‘unknown’;
return `${charName}::${chatId}`;
}

function getPersonaKey() {
const ctx = SillyTavern.getContext();
return `persona::${ctx.name1 || 'User'}`;
}

// ── Lore module loading ─────────────────────────────────────────────────────

/**

- Load a JS lore module from source text.
- The source must `export default { name, processTurn, handleResponse, ... }`
  */
  async function loadLoreFromSource(source, key) {
  const blob = new Blob([source], { type: ‘text/javascript’ });
  const url = URL.createObjectURL(blob);
  try {
  const mod = await import(url);
  const lore = mod.default;
  if (!lore || typeof lore.processTurn !== ‘function’) {
  throw new Error(‘Lore module must export default with processTurn()’);
  }
  // Run init if provided
  if (typeof lore.init === ‘function’) {
  lore._config = lore.init(lore.data || {});
  }
  lore._key = key;
  lore._source = source;
  console.log(`[OW] Loaded: ${lore.name || key} v${lore.version || '?'}`);
  return lore;
  } finally {
  URL.revokeObjectURL(url);
  }
  }

/**

- Upload lore source to ST’s server-side file storage.
- Stored as .txt because ST blocks .js uploads for security.
- Returns the server path used to retrieve it later.
  */
  async function uploadLoreToServer(source, key) {
  const uploadName = key + ‘.lore.txt’;
  const blob = new Blob([source], { type: ‘text/plain’ });
  const formData = new FormData();
  formData.append(‘file’, blob, uploadName);
  const resp = await fetch(’/api/files/upload’, { method: ‘POST’, body: formData });
  if (!resp.ok) {
  const text = await resp.text();
  throw new Error(`ST file upload failed ${resp.status}: ${text.slice(0, 200)}`);
  }
  const result = await resp.json();
  const serverPath = result.path || result.url;
  if (!serverPath) throw new Error(’ST upload response had no path: ’ + JSON.stringify(result));
  return serverPath;
  }

/**

- Import a lore from source text (file, URL fetch, or paste).
- - Validates by loading the module
- - Saves source to IndexedDB (this browser)
- - Uploads to ST server (all browsers on this ST instance will auto-sync)
- - Activates immediately
    */
    async function importAndActivateLore(source, filename) {
    const key = filename.replace(/.js$/, ‘’);
  
  // Validate by loading
  const lore = await loadLoreFromSource(source, key);
  
  // Store source in IDB for this browser
  await idbPut(STORE_LORE, key, {
  source,
  filename,
  name: lore.name || key,
  version: lore.version || ‘?’,
  importedAt: Date.now(),
  });
  
  // Upload to ST server so every other browser/device auto-syncs on next load
  try {
  const serverPath = await uploadLoreToServer(source, key);
  settings.server_lores = settings.server_lores || {};
  settings.server_lores[key] = serverPath;
  console.log(`[OW] Lore uploaded to ST server: ${serverPath}`);
  } catch (ex) {
  // Non-fatal: works on this browser, others won’t auto-sync until re-import
  console.warn(’[OW] Server upload failed (lore works locally only):’, ex.message);
  }
  
  // Activate
  activeLore = lore;
  settings.active_lore = key;
  saveSettings();
  
  return lore;
  }

/**

- Fetch and activate a lore .js file by URL.
- Works for any URL: GitHub raw, local server, extension folder, etc.
  */
  async function loadLoreFromUrl(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Fetch ${url} failed: ${resp.status}`);
  const source = await resp.text();
  const filename = url.split(’/’).pop() || ‘lore.js’;
  return importAndActivateLore(source, filename);
  }

/**

- Activate a previously imported lore module by key (from IDB).
  */
  async function activateStoredLore(key) {
  const stored = await idbGet(STORE_LORE, key);
  if (!stored || !stored.source) {
  console.warn(`[OW] No stored lore found for key: ${key}`);
  return null;
  }
  activeLore = await loadLoreFromSource(stored.source, key);
  settings.active_lore = key;
  saveSettings();
  return activeLore;
  }

/**

- Sync a lore from the ST server into local IDB and activate it.
- Called automatically on init for any key listed in settings.server_lores
- that isn’t already cached locally.
  */
  async function syncLoreFromServer(key, serverPath) {
  console.log(`[OW] Syncing lore from server: ${key}`);
  const resp = await fetch(serverPath);
  if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
  const source = await resp.text();
  const lore = await loadLoreFromSource(source, key);
  await idbPut(STORE_LORE, key, {
  source,
  filename: key + ‘.js’,
  name: lore.name || key,
  version: lore.version || ‘?’,
  importedAt: Date.now(),
  });
  console.log(`[OW] Synced into IDB: ${key} v${lore.version || '?'}`);
  return { lore, source };
  }

// ── Generate interceptor ────────────────────────────────────────────────────

globalThis.overwriteInterceptor = async function (chat, contextSize, abort, type) {
if (!settings.enabled) return;
if (type === ‘quiet’ || type === ‘impersonate’) return;

```
const ctx = SillyTavern.getContext();
const sessionKey = getSessionKey();
const personaKey = getPersonaKey();

let state = (await idbGet(STORE_STATE, sessionKey)) || {};
let personaState = (await idbGet(STORE_PERSONA, personaKey)) || {};

// ── Build systemText from multiple sources ──────────────────────────
let systemText = '';
const systemIdx = chat.findIndex(m => m.role === 'system');
if (systemIdx >= 0) {
    systemText = chat[systemIdx].content || '';
}

if (!systemText) {
    const charData = ctx.characters?.[ctx.characterId];
    if (charData) {
        const parts = [];
        if (charData.name)        parts.push('Name: ' + charData.name);
        if (charData.personality) parts.push('Personality: ' + charData.personality);
        if (charData.description) parts.push(charData.description);
        if (charData.scenario)    parts.push('Scenario: ' + charData.scenario);
        if (charData.mes_example) parts.push(charData.mes_example);
        systemText = parts.join('\n');
    }
}

if (!systemText) {
    const fallbackIdx = chat.findIndex(m => m.role !== 'user' && m.role !== 'assistant');
    if (fallbackIdx >= 0) systemText = chat[fallbackIdx].content || '';
}

if (settings.debug) {
    const src = systemIdx >= 0 && systemText ? 'chat[system]'
        : ctx.characters?.[ctx.characterId]?.name ? 'ctx.characters'
        : 'fallback';
    console.log('[OW] systemText:', systemText.length + 'ch from ' + src,
        '| chat roles:', chat.map((m, i) => m.role + '(' + (m.content || '').length + ')').join(', '));
    if (chat.length > 0) {
        console.log('[OW] ═══ RAW CHAT DUMP ═══');
        console.log('[OW] chat[0] keys:', Object.keys(chat[0]).join(', '));
        console.log('[OW] chat[0] raw:', JSON.stringify(chat[0]).substring(0, 500));
        if (chat.length > 1) {
            console.log('[OW] chat[last] keys:', Object.keys(chat[chat.length - 1]).join(', '));
            console.log('[OW] chat[last] raw:', JSON.stringify(chat[chat.length - 1]).substring(0, 500));
        }
        console.log('[OW] chat.length:', chat.length);
        console.log('[OW] ═══ END RAW DUMP ═══');
    }
}

let messages = chat.map(m => ({ role: m.role, content: m.content || '' }));

const hasContent = messages.some(m => m.content && m.content.length > 0 && m.role);
if (!hasContent && ctx.chat && ctx.chat.length > 0) {
    messages = [];
    for (const msg of ctx.chat) {
        if (!msg || msg.is_system) continue;
        const role = msg.is_user ? 'user' : 'assistant';
        const content = msg.mes || '';
        if (content) messages.push({ role, content });
    }
    if (settings.debug) {
        console.log('[OW] Messages rebuilt from ctx.chat:', messages.length,
            'msgs, roles:', messages.map(m => m.role + '(' + m.content.length + ')').join(', '));
    }
}

if (!activeLore) return;

const charData = ctx.characters?.[ctx.characterId];
const charNameHint = charData?.name || null;

let turnResult;
try {
    turnResult = await activeLore.processTurn({
        systemText,
        messages,
        state,
        personaState,
        config: activeLore._config || {},
        charNameHint,
        personaName: ctx.name1 || null,
    });
    if (!turnResult) {
        if (settings.debug) console.log('[OW] processTurn returned null');
        return;
    }
    state = turnResult.state || state;
    personaState = turnResult.persona_state || personaState;
} catch (ex) {
    console.error('[OW] processTurn error:', ex);
    return;
}

lastTurnResult = { ...turnResult, _mode: 'js' };

await idbPut(STORE_STATE, sessionKey, state);
await idbPut(STORE_PERSONA, personaKey, personaState);

const hasSTFormat = chat.some(m => 'is_user' in m && 'mes' in m);
const hasOpenAIFormat = chat.some(m => m.role === 'user' || m.role === 'assistant');

if (hasSTFormat || hasOpenAIFormat) {
    const findLastUser = () => {
        for (let i = chat.length - 1; i >= 0; i--) {
            if (hasSTFormat ? (chat[i].is_user && !chat[i].is_system) : chat[i].role === 'user')
                return i;
        }
        return -1;
    };
    const getMes = (m) => hasSTFormat ? (m.mes || '') : (m.content || '');
    const setMes = (m, val) => { if (hasSTFormat) m.mes = val; else m.content = val; };

    const sysPrompt = turnResult.systemPrompt;
    if (sysPrompt) {
        const sysIdx = hasSTFormat
            ? chat.findIndex(m => m.is_system)
            : chat.findIndex(m => m.role === 'system');
        if (sysIdx >= 0) setMes(chat[sysIdx], sysPrompt);
    }

    if (turnResult.brief) {
        const ui = findLastUser();
        if (ui >= 0) {
            setMes(chat[ui], `[DIRECTOR]\n${turnResult.brief}\n[/DIRECTOR]\n\n` + getMes(chat[ui]));
        }
    }

    if (Array.isArray(turnResult.inject)) {
        for (const inj of turnResult.inject) {
            applyInjection(chat, inj, hasSTFormat);
        }
    }

    if (settings.debug) console.log('[OW] Chat array injected directly (' + (hasSTFormat ? 'ST' : 'OpenAI') + ' format)');
} else {
    if (settings.debug) console.log('[OW] Chat array unrecognized — deferring to fetch interceptor');
}

window._owPendingInjection = {
    header: turnResult.header || null,
    brief: turnResult.brief || null,
    systemPrompt: turnResult.systemPrompt || null,
    inject: turnResult.inject || [],
    ts: Date.now(),
};

if (settings.debug) {
    console.log('[OW] Turn processed', {
        mode: lastTurnResult._mode,
        turn: state.turn,
        headerLength: turnResult.header?.length || 0,
        brief: turnResult.brief?.substring(0, 150),
        events: turnResult.events,
        injectCount: turnResult.inject?.length || 0,
        injectTextLen: turnResult.inject?.[0]?.text?.length || 0,
        pill: state.active_pill,
        arousal: state.arousal,
        chatInjected: hasSTFormat || hasOpenAIFormat,
    });
    if (turnResult.header) {
        console.log('[OW] ═══ INJECTED HEADER ═══\n' + turnResult.header + '\n[OW] ═══ END HEADER ═══');
    }
    if (turnResult.brief) {
        console.log('[OW] ═══ DIRECTOR BRIEF ═══\n' + turnResult.brief + '\n[OW] ═══ END BRIEF ═══');
    }
    updateDebugPanel(turnResult, state);
}
```

};

function applyInjection(chat, inj, stFormat) {
if (!inj || !inj.text) return;

```
const isUser = (m) => stFormat ? (m.is_user && !m.is_system) : m.role === 'user';
const isSystem = (m) => stFormat ? m.is_system : m.role === 'system';
const getMes = (m) => stFormat ? (m.mes || '') : (m.content || '');
const setMes = (m, val) => { if (stFormat) m.mes = val; else m.content = val; };

switch (inj.position) {
    case 'system': {
        const idx = chat.findIndex(isSystem);
        if (idx >= 0) {
            setMes(chat[idx], inj.replace ? inj.text : getMes(chat[idx]) + '\n' + inj.text);
        }
        break;
    }
    case 'before_last_user': {
        for (let i = chat.length - 1; i >= 0; i--) {
            if (isUser(chat[i])) {
                setMes(chat[i], inj.text + '\n\n' + getMes(chat[i]));
                break;
            }
        }
        break;
    }
    case 'after_last_user': {
        for (let i = chat.length - 1; i >= 0; i--) {
            if (isUser(chat[i])) {
                setMes(chat[i], getMes(chat[i]) + '\n\n' + inj.text);
                break;
            }
        }
        break;
    }
    case 'depth': {
        const depth = inj.depth || 0;
        const pos = Math.max(0, chat.length - depth);
        if (stFormat) {
            chat.splice(pos, 0, {
                name: '', is_user: false, is_system: true,
                mes: inj.text, send_date: new Date().toISOString(),
            });
        } else {
            chat.splice(pos, 0, {
                role: inj.role || 'system', content: inj.text,
            });
        }
        break;
    }
    case 'prefill': {
        if (stFormat) {
            chat.push({
                name: '', is_user: false, is_system: false,
                mes: inj.text, send_date: new Date().toISOString(),
            });
        } else {
            chat.push({ role: 'assistant', content: inj.text });
        }
        break;
    }
}
```

}

// ── Post-response handler ───────────────────────────────────────────────────

async function onMessageReceived(messageIndex) {
if (!settings.enabled || !lastTurnResult) return;

```
const ctx = SillyTavern.getContext();
const chat = ctx.chat;
if (!chat || messageIndex < 0 || messageIndex >= chat.length) return;

const msg = chat[messageIndex];
if (!msg || msg.is_user) return;

const assistantText = msg.mes || '';
const sessionKey = getSessionKey();
let result;

if (activeLore && typeof activeLore.handleResponse === 'function') {
    const evts = lastTurnResult.events || {};
    if (settings.debug) {
        console.log('[OW] handleResponse calling with:',
            'textLen=' + assistantText.length,
            'events=' + JSON.stringify(evts),
            'pill_taken=' + (evts.pill_taken || 'none'),
            'has BODY_RESULT=' + assistantText.includes('BODY_RESULT'),
            'has SCENE_STATE=' + assistantText.includes('SCENE_STATE'));
    }
    try {
        result = await activeLore.handleResponse({
            assistantText,
            state: lastTurnResult.state,
            events: evts,
            config: activeLore._config || {},
        });
        if (result) result.ok = true;
    } catch (ex) {
        console.error('[OW] handleResponse error:', ex);
    }
}

if (result?.ok) {
    await idbPut(STORE_STATE, sessionKey, result.state);

    const cleaned = result.cleanedText || result.cleaned_text;
    if (cleaned && cleaned !== assistantText) {
        msg.mes = cleaned;
        const el = document.querySelector(`#chat .mes[mesid="${messageIndex}"] .mes_text`);
        if (el) {
            el.innerHTML = ctx.messageFormatting?.(cleaned, msg.name, msg.is_system, msg.is_user, messageIndex) || cleaned;
        }
    }

    if (settings.debug) console.log('[OW] handleResponse done');
}

lastTurnResult = null;
```

}

// ── Settings UI ─────────────────────────────────────────────────────────────

function getSettingsHtml() {
return `
<div id="ow-settings">
<label style="margin-bottom:8px; display:flex; align-items:center; gap:6px;">
<input type="checkbox" id="ow-enabled">
<span>Enabled</span>
</label>

```
    <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>Lore Modules</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <select id="ow-active-select" class="text_pole" style="width:100%;margin-bottom:6px;">
                <option value="">(none loaded)</option>
            </select>
            <div style="display:flex; gap:4px; flex-wrap:wrap;">
                <button id="ow-import-btn" class="menu_button" title="Import a .js lore file from your device">Import (.js)</button>
                <button id="ow-import-url-btn" class="menu_button" title="Load a lore file from a URL (GitHub raw, etc.)">From URL</button>
                <button id="ow-reload-btn" class="menu_button">Reload</button>
                <button id="ow-remove-btn" class="menu_button redWarning">Remove</button>
            </div>
            <div id="ow-info" class="ow-status" style="display:none;margin-top:6px;"></div>
        </div>
    </div>

    <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>Debug</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <label style="margin-bottom:6px; display:flex; align-items:center; gap:6px;">
                <input type="checkbox" id="ow-debug">
                <span>Debug logging</span>
            </label>
            <div id="ow-debug-panel" style="display:none"></div>
        </div>
    </div>

    <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>State</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <div style="display:flex; gap:4px; flex-wrap:wrap;">
                <button id="ow-export-state" class="menu_button">Export</button>
                <button id="ow-import-state" class="menu_button">Import</button>
                <button id="ow-clear-state" class="menu_button redWarning">Clear (this chat)</button>
            </div>
        </div>
    </div>

    <div id="ow-module-settings"></div>
</div>`;
```

}

function bindSettingsEvents() {
bindCheckbox(‘ow-enabled’, ‘enabled’);
bindCheckbox(‘ow-debug’, ‘debug’, (v) => {
const p = document.getElementById(‘ow-debug-panel’);
if (p) p.style.display = v ? ‘block’ : ‘none’;
});

```
// Lore selector
const selectEl = document.getElementById('ow-active-select');
if (selectEl) {
    selectEl.addEventListener('change', async () => {
        const key = selectEl.value;
        if (!key) {
            activeLore = null;
            settings.active_lore = null;
            saveSettings();
            clearModuleSettings();
            return;
        }
        try {
            await activateStoredLore(key);
            showLoreInfo(`Activated: ${activeLore.name || key}`, 'ok');
            renderModuleSettings();
        } catch (ex) {
            showLoreInfo(`Failed to load: ${ex.message}`, 'err');
        }
    });
    refreshLoreSelector();
}

// Import from file
document.getElementById('ow-import-btn')?.addEventListener('click', handleImportLore);

// Import from URL (GitHub raw, etc.)
document.getElementById('ow-import-url-btn')?.addEventListener('click', async () => {
    const url = prompt('Enter the URL of your lore .js file:\n(e.g. GitHub raw URL)');
    if (!url || !url.trim()) return;
    showLoreInfo('Loading from URL...', '');
    try {
        const lore = await loadLoreFromUrl(url.trim());
        await refreshLoreSelector();
        showLoreInfo(`✅ Loaded & synced: ${lore.name || 'lore'} v${lore.version || '?'}`, 'ok');
        renderModuleSettings();
    } catch (ex) {
        showLoreInfo(`Failed: ${ex.message}`, 'err');
    }
});

// Reload
document.getElementById('ow-reload-btn')?.addEventListener('click', async () => {
    const key = settings.active_lore;
    if (!key) { showLoreInfo('No active lore to reload.', 'err'); return; }
    showLoreInfo('Reloading...', '');

    // Try server copy first (always freshest)
    const serverPath = settings.server_lores?.[key];
    if (serverPath) {
        try {
            const resp = await fetch(serverPath);
            if (!resp.ok) throw new Error(`${resp.status}`);
            const source = await resp.text();
            const lore = await importAndActivateLore(source, key + '.js');
            await refreshLoreSelector();
            showLoreInfo(`✅ Reloaded: ${lore.name || key} v${lore.version || '?'}`, 'ok');
            renderModuleSettings();
            return;
        } catch (ex) {
            console.warn('[OW] Server reload failed, trying IDB:', ex.message);
        }
    }

    // Fall back to IDB
    const stored = await idbGet(STORE_LORE, key);
    if (stored?.source) {
        try {
            activeLore = await loadLoreFromSource(stored.source, key);
            settings.active_lore = key;
            saveSettings();
            await refreshLoreSelector();
            showLoreInfo(`✅ Reloaded from cache: ${activeLore.name || key}`, 'ok');
            renderModuleSettings();
            return;
        } catch (ex) {
            console.warn('[OW] IDB reload failed:', ex.message);
        }
    }

    // Extension folder fallback
    try {
        const lore = await loadLoreFromUrl('./x_change_world.js');
        await refreshLoreSelector();
        showLoreInfo(`✅ Reloaded: ${lore.name || key}`, 'ok');
        renderModuleSettings();
    } catch (ex) {
        showLoreInfo(`Reload failed: ${ex.message}`, 'err');
    }
});

document.getElementById('ow-remove-btn')?.addEventListener('click', handleRemoveLore);

// State buttons
document.getElementById('ow-export-state')?.addEventListener('click', exportState);
document.getElementById('ow-import-state')?.addEventListener('click', importState);
document.getElementById('ow-clear-state')?.addEventListener('click', clearState);
```

}

function bindCheckbox(id, key, onChange) {
const el = document.getElementById(id);
if (!el) return;
el.checked = settings[key];
el.addEventListener(‘change’, () => {
settings[key] = el.checked;
saveSettings();
if (onChange) onChange(el.checked);
});
}

function bindInput(id, key, transform) {
const el = document.getElementById(id);
if (!el) return;
el.value = settings[key] || ‘’;
el.addEventListener(‘change’, () => {
settings[key] = transform ? transform(el.value) : el.value;
saveSettings();
});
}

function showLoreInfo(msg, type) {
const el = document.getElementById(‘ow-info’);
if (!el) return;
el.style.display = ‘block’;
el.textContent = msg;
el.className = `ow-status ${type || ''}`;
}

async function refreshLoreSelector() {
const el = document.getElementById(‘ow-active-select’);
if (!el) return;
el.innerHTML = ‘<option value="">(none)</option>’;
const all = await idbGetAll(STORE_LORE);
for (const entry of all) {
const d = entry.data;
const opt = document.createElement(‘option’);
opt.value = entry.id;
opt.textContent = `${d.name || entry.id} v${d.version || '?'}`;
if (entry.id === settings.active_lore) opt.selected = true;
el.appendChild(opt);
}
}

async function handleImportLore() {
const input = document.createElement(‘input’);
input.type = ‘file’;
input.accept = ‘.js’;
input.onchange = async (e) => {
const file = e.target.files?.[0];
if (!file) return;
showLoreInfo(`Importing ${file.name}...`, ‘’);
try {
const source = await file.text();
const lore = await importAndActivateLore(source, file.name);
await refreshLoreSelector();
showLoreInfo(`✅ Imported & synced: ${lore.name || file.name} v${lore.version || '?'}`, ‘ok’);
renderModuleSettings();
} catch (ex) {
console.error(’[OW] Import failed:’, ex);
showLoreInfo(`Import failed: ${ex.message}`, ‘err’);
}
};
input.click();
}

async function handleRemoveLore() {
const el = document.getElementById(‘ow-active-select’);
const key = el?.value;
if (!key) return;
if (!confirm(`Remove lore module "${key}"?`)) return;
await idbDelete(STORE_LORE, key);
// Also remove from server_lores so other browsers stop auto-syncing it
if (settings.server_lores?.[key]) {
delete settings.server_lores[key];
}
if (settings.active_lore === key) {
activeLore = null;
settings.active_lore = null;
clearModuleSettings();
}
saveSettings();
await refreshLoreSelector();
showLoreInfo(‘Removed.’, ‘ok’);
}

// ── Lore module settings (injected by the lore) ────────────────────────────

function renderModuleSettings() {
const container = document.getElementById(‘ow-module-settings’);
if (!container) return;
if (!activeLore || typeof activeLore.getSettingsHtml !== ‘function’) {
container.innerHTML = ‘’;
return;
}
container.innerHTML = ` <div class="inline-drawer"> <div class="inline-drawer-toggle inline-drawer-header"> <b>${activeLore.name || 'Lore'} Settings</b> <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div> </div> <div class="inline-drawer-content"> ${activeLore.getSettingsHtml(activeLore._config || {})} </div> </div>`;
if (typeof activeLore.onSettingsRendered === ‘function’) {
activeLore.onSettingsRendered(activeLore._config || {});
}
}

function clearModuleSettings() {
const container = document.getElementById(‘ow-module-settings’);
if (container) container.innerHTML = ‘’;
}

// ── State management ────────────────────────────────────────────────────────

async function exportState() {
const sessionKey = getSessionKey();
const personaKey = getPersonaKey();
const state = await idbGet(STORE_STATE, sessionKey);
const persona = await idbGet(STORE_PERSONA, personaKey);
const blob = new Blob(
[JSON.stringify({ sessionKey, personaKey, state, persona, exportedAt: Date.now() }, null, 2)],
{ type: ‘application/json’ }
);
const a = document.createElement(‘a’);
a.href = URL.createObjectURL(blob);
a.download = `lore-state-${Date.now()}.json`;
a.click();
}

async function importState() {
const input = document.createElement(‘input’);
input.type = ‘file’;
input.accept = ‘.json’;
input.onchange = async (e) => {
const file = e.target.files?.[0];
if (!file) return;
try {
const data = JSON.parse(await file.text());
if (data.state) await idbPut(STORE_STATE, data.sessionKey || getSessionKey(), data.state);
if (data.persona) await idbPut(STORE_PERSONA, data.personaKey || getPersonaKey(), data.persona);
alert(‘State imported.’);
} catch (ex) {
alert(’Import failed: ’ + ex.message);
}
};
input.click();
}

async function clearState() {
if (!confirm(‘Clear all lore state for this chat?’)) return;
await idbPut(STORE_STATE, getSessionKey(), {});
alert(‘State cleared.’);
}

// ── Debug panel ─────────────────────────────────────────────────────────────

function updateDebugPanel(turn, state) {
const panel = document.getElementById(‘ow-debug-panel’);
if (!panel || !settings.debug) return;
panel.style.display = ‘block’;
_renderDebugContent(panel, state, turn.events || {});
}

async function refreshDebugPanel() {
const panel = document.getElementById(‘ow-debug-panel’);
if (!panel) return;
panel.style.display = ‘block’;
const sessionKey = getSessionKey();
const state = (await idbGet(STORE_STATE, sessionKey)) || {};
_renderDebugContent(panel, state, {});
}

async function _renderDebugContent(panel, state, events) {
let info = ‘’;
if (activeLore && typeof activeLore.getDebugInfo === ‘function’) {
let ps = {};
try {
const personaKey = getPersonaKey();
ps = (await idbGet(STORE_PERSONA, personaKey)) || {};
} catch (e) { /* ignore */ }
const raw = activeLore.getDebugInfo(state, events, activeLore._config || {}, ps);
info = typeof raw === ‘string’ ? raw : JSON.stringify(raw, null, 2);
} else {
info = [
`Turn: ${state?.turn || '?'}`,
`Events: ${Object.keys(events).join(', ') || 'none'}`,
].join(’\n’);
}

```
panel.innerHTML = `<pre style="
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 11px;
    line-height: 1.4;
    background: var(--SmartThemeBlurTintColor, #1a1a2e);
    color: var(--SmartThemeBodyColor, #ccc);
    padding: 8px 10px;
    border-radius: 4px;
    max-height: 500px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-word;
    margin: 4px 0;
">${escapeHtml(info)}</pre>
<div style="display:flex; gap:4px; margin-top:4px; flex-wrap:wrap;">
    <button class="menu_button" id="ow-debug-refresh">Refresh</button>
    <button class="menu_button" id="ow-debug-copy">Copy</button>
    <button class="menu_button" id="ow-debug-dump-state">Dump JSON</button>
    <button class="menu_button" id="ow-debug-dump-header">Dump Header</button>
</div>`;

document.getElementById('ow-debug-refresh')?.addEventListener('click', refreshDebugPanel);

document.getElementById('ow-debug-copy')?.addEventListener('click', () => {
    const _copyDone = () => {
        const btn = document.getElementById('ow-debug-copy');
        if (btn) { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy', 1500); }
    };
    const _copyFail = () => {
        const btn = document.getElementById('ow-debug-copy');
        if (btn) { btn.textContent = 'Failed'; setTimeout(() => btn.textContent = 'Copy', 1500); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(info).then(_copyDone).catch(() => {
            _fallbackCopy(info) ? _copyDone() : _copyFail();
        });
    } else {
        _fallbackCopy(info) ? _copyDone() : _copyFail();
    }
});

document.getElementById('ow-debug-dump-state')?.addEventListener('click', async () => {
    const sessionKey = getSessionKey();
    const fullState = (await idbGet(STORE_STATE, sessionKey)) || state;
    const dump = JSON.stringify(fullState, null, 2);
    const blob = new Blob([dump], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `ow-state-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
});

document.getElementById('ow-debug-dump-header')?.addEventListener('click', () => {
    const header = lastTurnResult?.header || lastTurnResult?.brief || '(no header from last turn)';
    const blob = new Blob([header], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `ow-header-${Date.now()}.txt`; a.click();
    URL.revokeObjectURL(url);
});
```

}

function escapeHtml(s) {
return (s || ‘’).replace(/&/g, ‘&’).replace(/</g, ‘<’).replace(/>/g, ‘>’);
}

function _fallbackCopy(text) {
try {
const ta = document.createElement(‘textarea’);
ta.value = text;
ta.style.position = ‘fixed’;
ta.style.left = ‘-9999px’;
ta.style.top = ‘-9999px’;
document.body.appendChild(ta);
ta.focus();
ta.select();
const ok = document.execCommand(‘copy’);
document.body.removeChild(ta);
return ok;
} catch (e) {
return false;
}
}

// ── Settings persistence ────────────────────────────────────────────────────

function loadSettings() {
const ctx = SillyTavern.getContext();
if (!ctx.extensionSettings[MODULE_NAME]) {
ctx.extensionSettings[MODULE_NAME] = structuredClone(DEFAULTS);
}
settings = ctx.extensionSettings[MODULE_NAME];
for (const [k, v] of Object.entries(DEFAULTS)) {
if (!(k in settings)) settings[k] = v;
}
}

function saveSettings() {
const ctx = SillyTavern.getContext();
ctx.extensionSettings[MODULE_NAME] = settings;
ctx.saveSettingsDebounced();
}

// ── Init ────────────────────────────────────────────────────────────────────

(async function init() {
try {
db = await openDB();
console.log(’[OW] IndexedDB ready’);
} catch (ex) {
console.error(’[OW] IndexedDB failed:’, ex);
return;
}

```
loadSettings();

// ── Auto-sync lores from ST server ──────────────────────────────────────
// ST extension settings are stored server-side and shared across ALL
// browsers/devices on the same ST instance.  When any browser imports a
// lore, it uploads the file and saves the server path into settings.
// Every other browser hits this block on load, fetches the file from the
// ST server, and caches it locally — no manual action required.

if (settings.server_lores && Object.keys(settings.server_lores).length > 0) {
    for (const [key, serverPath] of Object.entries(settings.server_lores)) {
        try {
            await syncLoreFromServer(key, serverPath);
        } catch (ex) {
            console.warn(`[OW] Failed to sync lore "${key}" from server:`, ex.message);
        }
    }
}

// Activate last-used lore (now guaranteed to be in IDB from sync above)
if (settings.active_lore) {
    try {
        await activateStoredLore(settings.active_lore);
    } catch (ex) {
        console.warn('[OW] Could not activate lore:', ex);
    }
}

// Auto-fetch from extension folder as final fallback
if (!activeLore) {
    try {
        await loadLoreFromUrl('./x_change_world.js');
        console.log('[OW] Auto-loaded lore from extension folder');
    } catch (ex) {
        console.log('[OW] No lore found in extension folder');
    }
}

const ctx = SillyTavern.getContext();

// Settings panel
const container = document.getElementById('extensions_settings2');
if (container) {
    const wrapper = document.createElement('div');
    wrapper.classList.add('extension_container');
    wrapper.innerHTML = `
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>Overwrite</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                ${getSettingsHtml()}
            </div>
        </div>
    `;
    container.appendChild(wrapper);
    bindSettingsEvents();
    renderModuleSettings();
}

// Post-response hook
const { eventSource, event_types } = ctx;
if (eventSource && event_types) {
    eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);
}

if (settings.debug && event_types) {
    const genEvents = Object.entries(event_types)
        .filter(([k]) => /GENERAT|PROMPT|CHAT_COMP|COMBINE|SEND|BEFORE|AFTER|COMPLETION/i.test(k))
        .map(([k, v]) => `${k}=${v}`);
    console.log('[OW] Available generation-related events:', genEvents.join(' | '));
    console.log('[OW] ALL event_types:', Object.keys(event_types).join(', '));
}

// ── Fetch interceptor ───────────────────────────────────────────────────
if (!window._owFetchInstalled) {
    const _origFetch = window.fetch;
    window.fetch = async function (...args) {
        const [url, opts] = args;
        const urlStr = typeof url === 'string' ? url : url?.url || '';
        const pending = window._owPendingInjection;

        if (pending && pending.ts && (Date.now() - pending.ts < 30000) &&
            opts?.method === 'POST' && opts?.body && typeof opts.body === 'string' && opts.body.length > 500) {
            try {
                const payload = JSON.parse(opts.body);
                let modified = false;

                if (payload.messages && Array.isArray(payload.messages)) {
                    if (urlStr.includes('/settings/')) throw 'skip';

                    let lastUserIdx = -1;
                    for (let i = payload.messages.length - 1; i >= 0; i--) {
                        if (payload.messages[i].role === 'user') {
                            lastUserIdx = i;
                            break;
                        }
                    }

                    if (lastUserIdx >= 0) {
                        let userContent = payload.messages[lastUserIdx].content || '';
                        if (pending.header) {
                            userContent = pending.header + '\n\n' + userContent;
                        }
                        if (pending.brief) {
                            userContent = `[DIRECTOR]\n${pending.brief}\n[/DIRECTOR]\n\n` + userContent;
                        }
                        payload.messages[lastUserIdx].content = userContent;
                        modified = true;
                    }

                    if (pending.systemPrompt) {
                        const sysIdx = payload.messages.findIndex(m => m.role === 'system');
                        if (sysIdx >= 0) {
                            payload.messages[sysIdx].content = pending.systemPrompt;
                            modified = true;
                        }
                    }
                } else if (payload.prompt && typeof payload.prompt === 'string') {
                    if (urlStr.includes('/settings/')) throw 'skip';

                    let prompt = payload.prompt;
                    if (pending.header || pending.brief) {
                        const injection = (pending.brief ? `[DIRECTOR]\n${pending.brief}\n[/DIRECTOR]\n\n` : '') +
                                          (pending.header || '');
                        const lastNewlines = prompt.lastIndexOf('\n\n');
                        if (lastNewlines > prompt.length * 0.5) {
                            prompt = prompt.substring(0, lastNewlines) + '\n\n' + injection + prompt.substring(lastNewlines);
                        } else {
                            prompt = injection + '\n\n' + prompt;
                        }
                        payload.prompt = prompt;
                        modified = true;
                    }
                }

                if (modified) {
                    window._owPendingInjection = null;
                    opts.body = JSON.stringify(payload);

                    if (settings.debug) {
                        console.log('[OW] ═══ FETCH INJECTION APPLIED ═══');
                        console.log('[OW] URL:', urlStr);
                        if (payload.messages) {
                            console.log('[OW] Message count:', payload.messages.length);
                            for (let i = 0; i < payload.messages.length; i++) {
                                const m = payload.messages[i];
                                const c = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
                                const hasOW = c.includes('SCENE TRACKING') || c.includes('TRANSFORMATION') || c.includes('DIRECTOR');
                                console.log(`[OW]   [${i}] role=${m.role} len=${c.length} hasOW=${hasOW}`);
                            }
                        } else if (payload.prompt) {
                            console.log('[OW] Prompt length:', payload.prompt.length);
                            console.log('[OW] Contains OW:', payload.prompt.includes('SCENE TRACKING') || payload.prompt.includes('DIRECTOR'));
                        }
                        console.log('[OW] ═══ END FETCH INJECTION ═══');
                    }
                }
            } catch (e) {
                if (e !== 'skip' && settings.debug) {
                    console.warn('[OW] Fetch intercept parse error:', e);
                }
            }
        }
        return _origFetch.apply(this, args);
    };
    window._owFetchInstalled = true;
    console.log('[OW] Fetch interceptor installed');
}

console.log(`[OW] Extension loaded — lore: ${activeLore ? activeLore.name : 'none'}`);
```

})();
