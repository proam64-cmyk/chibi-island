/* Minimal test harness shared by Node (npm test) and the in-app QA page. */
(function (A) {
  'use strict';
  const H = (A.testHarness = { tests: [] });
  A.testFiles = ['core.spec.js', 'prompts.spec.js', 'routing.spec.js'];
  H.describe = function (suite, fn) {
    fn((name, body) => H.tests.push({ suite, name, body }));
  };
  function fail(msg) { throw new Error(msg); }
  H.assert = (cond, msg) => { if (!cond) fail(msg || 'assertion failed'); };
  H.eq = (a, b, msg) => { if (a !== b) fail((msg ? msg + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); };
  H.includes = (text, sub, msg) => { if (!String(text).includes(sub)) fail((msg ? msg + ': ' : '') + 'expected text to include ' + JSON.stringify(sub)); };
  H.excludes = (text, sub, msg) => { if (String(text).includes(sub)) fail((msg ? msg + ': ' : '') + 'expected text NOT to include ' + JSON.stringify(sub)); };
  H.match = (text, re, msg) => { if (!re.test(String(text))) fail((msg ? msg + ': ' : '') + 'expected text to match ' + re); };
  H.throws = (fn, re, msg) => {
    let threw = false;
    try { fn(); } catch (e) { threw = true; if (re && !re.test(e.message)) fail((msg ? msg + ': ' : '') + 'error "' + e.message + '" does not match ' + re); }
    if (!threw) fail((msg ? msg + ': ' : '') + 'expected function to throw');
  };
  H.run = async function (filter) {
    const t0 = Date.now();
    const results = [];
    for (const tc of H.tests) {
      if (filter && !filter(tc)) continue;
      try { await tc.body(); results.push({ suite: tc.suite, name: tc.name, ok: true }); }
      catch (e) { results.push({ suite: tc.suite, name: tc.name, ok: false, error: e && e.message ? e.message : String(e) }); }
    }
    return { results, passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, ms: Date.now() - t0 };
  };
})(globalThis.AGPS = globalThis.AGPS || {});
