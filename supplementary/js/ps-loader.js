/* ps-loader.js — classic-script data loader for the project page.
 *
 * Some hosts serve a page inside a sandbox with an opaque origin, where
 * fetch()/XHR of local files fail, ES modules fail and storage APIs throw. The
 * transport that works everywhere is a classic <script src="..."> with a relative path.
 * Every data file is therefore an IIFE that merges into window.PS; this module
 * injects the tag, waits for the expected PS.* key to appear, and reports
 * timeouts. No external URLs, no storage, no fetch.
 */
(function () {
  'use strict';

  var PS = (window.PS = window.PS || {});
  if (PS.load) { return; }

  PS.maps = PS.maps || {};

  var DEFAULT_TIMEOUT = 25000;
  var MAP_CACHE_LIMIT = 3;

  /* ---- small helpers ------------------------------------------------- */

  function noop() {}

  /* Resolve "maps.office2/pow3r" against window.PS without eval.
     The first segment is a PS property; the rest (which may itself contain
     slashes, e.g. a map key) is looked up as one literal key. */
  function lookup(key) {
    if (!key) { return undefined; }
    var dot = key.indexOf('.');
    if (dot < 0) { return PS[key]; }
    var head = key.slice(0, dot);
    var rest = key.slice(dot + 1);
    var box = PS[head];
    return box ? box[rest] : undefined;
  }

  function expectedValue(expect) {
    if (typeof expect === 'function') { return expect(); }
    if (typeof expect === 'string') { return lookup(expect); }
    return true; /* nothing to wait for beyond onload */
  }

  /* ---- LRU over PS.maps ---------------------------------------------- */
  /* Point clouds are the only large payloads. Keep at most MAP_CACHE_LIMIT of
     them alive so switching scenes on a phone does not grow without bound. */

  var mapOrder = [];

  function touchMap(key) {
    var i = mapOrder.indexOf(key);
    if (i >= 0) { mapOrder.splice(i, 1); }
    mapOrder.push(key);
    while (mapOrder.length > MAP_CACHE_LIMIT) {
      var old = mapOrder.shift();
      if (old !== key && PS.maps[old]) { delete PS.maps[old]; }
    }
  }

  function pinned(keys) {
    /* Keys the caller is about to use must never be evicted first. */
    for (var i = 0; i < keys.length; i++) { touchMap(keys[i]); }
  }

  /* ---- load ----------------------------------------------------------- */

  var inflight = {};   /* path -> request */
  var groups = {};     /* group name -> request (only the newest survives) */
  var doneScripts = {};/* path -> true once its script has executed */

  /**
   * PS.load(path, opts)
   *   path       relative to the site root, e.g. "supplementary/maps/x.data.js"
   *   opts.expect      string key ("maps.office2/pow3r") or function; the load
   *                    resolves when it becomes truthy
   *   opts.timeoutMs   default 25000
   *   opts.group       requests in a group supersede each other; when the user
   *                    switches scene the stale one is cancelled
   *   opts.onDone(value, path)
   *   opts.onError(reason, path)   reason: "timeout" | "error" | "cancelled"
   *   opts.onProgress(elapsedMs, timeoutMs)  called ~10x/s while pending
   * Returns a handle with .cancel() and .path.
   */
  function load(path, opts) {
    opts = opts || {};
    var expect = opts.expect;
    var timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT;
    var onDone = opts.onDone || noop;
    var onError = opts.onError || noop;
    var onProgress = opts.onProgress || noop;

    /* Already in memory? Answer on a microtask so callers always see the same
       asynchronous shape. */
    var have = expectedValue(expect);
    if (have && (doneScripts[path] || typeof expect !== 'undefined')) {
      var cancelled = false;
      setTimeout(function () { if (!cancelled) { onDone(have, path); } }, 0);
      return { path: path, cancel: function () { cancelled = true; } };
    }

    if (opts.group && groups[opts.group] && groups[opts.group].path !== path) {
      groups[opts.group].cancel();
    }

    var req = inflight[path];
    if (req) {
      /* Someone else is already loading this file: just add a listener. */
      req.listeners.push({ onDone: onDone, onError: onError, onProgress: onProgress, expect: expect, live: true });
      var mine = req.listeners[req.listeners.length - 1];
      var handleShared = {
        path: path,
        cancel: function () { mine.live = false; mine.onError('cancelled', path); }
      };
      if (opts.group) { groups[opts.group] = handleShared; }
      return handleShared;
    }

    var started = Date.now();
    var script = document.createElement('script');
    var tick = null;
    var timer = null;
    var settled = false;

    req = inflight[path] = {
      path: path,
      listeners: [{ onDone: onDone, onError: onError, onProgress: onProgress, expect: expect, live: true }]
    };

    function finish(kind, payloadFor) {
      if (settled) { return; }
      settled = true;
      if (tick) { clearInterval(tick); }
      if (timer) { clearTimeout(timer); }
      delete inflight[path];
      var list = req.listeners;
      for (var i = 0; i < list.length; i++) {
        var l = list[i];
        if (!l.live) { continue; }
        l.live = false;
        if (kind === 'done') { l.onDone(payloadFor(l.expect), path); }
        else { l.onError(kind, path); }
      }
      if (script.parentNode) { script.parentNode.removeChild(script); }
    }

    function anyoneWaiting() {
      for (var i = 0; i < req.listeners.length; i++) { if (req.listeners[i].live) { return true; } }
      return false;
    }

    script.src = path;          /* relative — the site lives under /w/<id>/ */
    script.async = true;
    script.defer = false;
    script.onload = function () {
      doneScripts[path] = true;
      /* The IIFE has run; the key must exist now. */
      var ok = true;
      for (var i = 0; i < req.listeners.length; i++) {
        var l = req.listeners[i];
        if (l.live && !expectedValue(l.expect)) { ok = false; }
      }
      if (ok) { finish('done', expectedValue); }
      else { finish('error', expectedValue); }
    };
    script.onerror = function () { finish('error', expectedValue); };

    tick = setInterval(function () {
      if (settled) { return; }
      if (!anyoneWaiting()) { finish('cancelled', expectedValue); return; }
      var el = Date.now() - started;
      for (var i = 0; i < req.listeners.length; i++) {
        if (req.listeners[i].live) { req.listeners[i].onProgress(el, timeoutMs); }
      }
    }, 100);

    timer = setTimeout(function () { finish('timeout', expectedValue); }, timeoutMs);

    document.head.appendChild(script);

    var own = req.listeners[0];
    var handle = {
      path: path,
      cancel: function () {
        if (own.live) { own.live = false; own.onError('cancelled', path); }
      }
    };
    if (opts.group) { groups[opts.group] = handle; }
    return handle;
  }

  /* ---- whenNear -------------------------------------------------------- */
  /* Run fn once the element has been near the viewport for `settleMs`, so that
     jumping to an anchor further down the page does not boot every heavy
     component it scrolls past. Falls back to running immediately where
     IntersectionObserver is missing. */

  function whenNear(el, fn, options) {
    options = options || {};
    var settleMs = options.settleMs == null ? 300 : options.settleMs;
    var margin = options.rootMargin || '300px 0px';
    if (!el) { return; }
    if (typeof IntersectionObserver !== 'function') { setTimeout(fn, 0); return; }
    var pending = null;
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          if (pending == null) {
            pending = setTimeout(function () {
              io.disconnect();
              fn();
            }, settleMs);
          }
        } else if (pending != null) {
          clearTimeout(pending);
          pending = null;
        }
      }
    }, { rootMargin: margin, threshold: 0 });
    io.observe(el);
  }

  /* ---- misc ------------------------------------------------------------ */

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }

  function fmtBytes(b) {
    if (b == null || !isFinite(b)) { return ''; }
    if (b >= 1e6) { return (b / 1e6).toFixed(1) + ' MB'; }
    return Math.max(1, Math.round(b / 1024)) + ' KB';
  }

  function fmtDuration(s) {
    if (s == null || !isFinite(s)) { return ''; }
    var t = Math.round(s);
    var m = Math.floor(t / 60);
    var r = t % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  PS.load = load;
  PS.whenNear = whenNear;
  PS.touchMap = touchMap;
  PS.pinMaps = pinned;
  PS.util = { el: el, escapeHtml: escapeHtml, fmtBytes: fmtBytes, fmtDuration: fmtDuration };
})();
