/**
 * StatefulLore  --  bootstrap loader (v2.0.8+)
 *
 * This file is intentionally tiny and stable. It will be cached aggressively
 * by browsers (especially iPad Safari PWA mode) — that's fine and intentional.
 *
 * All real extension code lives in core.js. The bootstrap fetches core.js with
 * a timestamp cache-buster on every load, so we never serve stale code even
 * when the browser has the old core.js cached at the same path.
 *
 * Implementation notes:
 *  - SillyTavern loads extensions as ES modules (script.type = 'module' in
 *    public/scripts/extensions.js around line 770). Top-level await here
 *    blocks ST's `script.onload` until core.js finishes executing, so ST
 *    sees the extension as fully loaded before it queries
 *    globalThis.overwriteInterceptor or any other global.
 *  - The query string `?t=<ms>` is unique per load, so the browser sees a URL
 *    it has never cached and always fetches fresh.
 *  - cache: 'no-store' on the underlying request belt-and-suspenders against
 *    intermediate HTTP caches.
 *
 * After this bootstrap is in place, future versions of the extension only
 * need to update core.js. index.js NEVER needs to change again — even though
 * the browser keeps its old cached copy, that copy still does the right thing.
 *
 * Author: Cody  |  https://github.com/cgstever/StatefulLore
 */

const _SL_BOOTSTRAP_VERSION = '2.0.8';

try {
    // Resolve core.js relative to this module's URL so we work regardless of
    // where ST mounts the extension (third-party path, global path, etc).
    const _slCoreUrl = new URL('./core.js', import.meta.url);
    _slCoreUrl.searchParams.set('t', Date.now().toString());

    // Top-level await: blocks ST's "extension loaded" signal until core.js
    // has fully imported and executed (registered globals, hooks, etc).
    await import(_slCoreUrl.href);

    // eslint-disable-next-line no-console
    console.log(`[OW] Bootstrap v${_SL_BOOTSTRAP_VERSION} loaded core.js fresh (no-cache)`);
} catch (err) {
    // eslint-disable-next-line no-console
    console.error('[OW] Bootstrap failed to load core.js:', err);
    // Re-throw so ST sees the load failure and surfaces it in the extensions panel.
    throw err;
}
