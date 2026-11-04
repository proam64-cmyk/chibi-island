/* Anime Game Prompt Studio — shared utilities (no DOM dependencies). */
(function (A) {
  'use strict';
  const U = (A.util = {});

  U.uid = function (prefix) {
    const t = Date.now().toString(36).toUpperCase().slice(-5);
    const r = Math.random().toString(36).slice(2, 6).toUpperCase();
    return (prefix || 'ID') + '-' + t + r;
  };
  U.now = () => new Date().toISOString();
  U.clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
  U.esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.lines = (s) => (Array.isArray(s) ? s : String(s || '').split(/\r?\n/)).map((x) => String(x).trim()).filter(Boolean);
  U.list = (s) => (Array.isArray(s) ? s : String(s || '').split(/[,\n;]/)).map((x) => String(x).trim()).filter(Boolean);
  U.has = (v) => v != null && !(Array.isArray(v) && v.length === 0) && String(v).trim() !== '';
  U.estimateTokens = (text) => Math.ceil(String(text || '').length / 4);
  U.slug = (s) =>
    String(s || 'untitled').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 60) || 'untitled';
  U.clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  U.uniq = (arr) => Array.from(new Set(arr));
  U.get = function (obj, path) {
    return String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  };
  U.set = function (obj, path, value) {
    const keys = String(path).split('.');
    let o = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (o[keys[i]] == null || typeof o[keys[i]] !== 'object') o[keys[i]] = {};
      o = o[keys[i]];
    }
    o[keys[keys.length - 1]] = value;
  };
  U.debounce = function (fn, ms) {
    let t = null;
    const d = function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms);
    };
    d.flush = function () { clearTimeout(t); fn(); };
    return d;
  };
  U.fmtDate = (iso) => {
    try { return new Date(iso).toLocaleString(); } catch (e) { return String(iso); }
  };
  U.money = (v) => (v < 0.01 ? '$' + v.toFixed(4) : '$' + v.toFixed(3));

  /** Line-based LCS diff. Returns [{op:'same'|'add'|'del', text}] */
  U.diffLines = function (a, b) {
    const x = String(a || '').split('\n');
    const y = String(b || '').split('\n');
    const n = x.length, m = y.length;
    if (n * m > 4e6) {
      // too large for a full table: coarse fallback
      return x.map((t) => ({ op: 'del', text: t })).concat(y.map((t) => ({ op: 'add', text: t })));
    }
    const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const out = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (x[i] === y[j]) { out.push({ op: 'same', text: x[i] }); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ op: 'del', text: x[i] }); i++; }
      else { out.push({ op: 'add', text: y[j] }); j++; }
    }
    while (i < n) out.push({ op: 'del', text: x[i++] });
    while (j < m) out.push({ op: 'add', text: y[j++] });
    return out;
  };

  /** Simple {{path}} template rendering. Missing values become [MISSING: path] so the corrector can flag them. */
  U.renderTemplate = function (tpl, ctx) {
    return String(tpl || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
      const v = U.get(ctx, path);
      if (!U.has(v)) return '[MISSING: ' + path + ']';
      return Array.isArray(v) ? v.join(', ') : String(v);
    });
  };

  U.hexOk = (h) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(h || '').trim());
})(globalThis.AGPS = globalThis.AGPS || {});
