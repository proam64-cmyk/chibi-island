/* Loads all studio scripts into the current Node global (same files the browser loads). */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const FILES = [
  'js/core/util.js', 'js/core/schema.js', 'js/core/storage.js', 'js/core/i18n.js',
  'js/engine/context.js', 'js/engine/compiler.js', 'js/engine/image.js', 'js/engine/meshy.js',
  'js/engine/gameplay.js', 'js/engine/existing.js', 'js/engine/android.js', 'js/engine/router.js',
  'js/engine/categories.js', 'js/data/presets.js', 'js/data/templates.js',
];
module.exports = function load(extra) {
  FILES.concat(extra || []).forEach((f) => {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) return;
    vm.runInThisContext(fs.readFileSync(p, 'utf8'), { filename: p });
  });
  return globalThis.AGPS;
};
module.exports.FILES = FILES;
