/* Structured prompt compiler: quality filtering, rendering, phase splitting, expand/refine/correct, lint rules. */
(function (A) {
  'use strict';
  const U = A.util;
  const P = (A.compiler = {});

  P.QUALITY = { standard: 1, professional: 2, ultra: 3 };
  P.QUALITY_NAMES = ['standard', 'professional', 'ultra'];
  P.qLevel = (name) => P.QUALITY[name] || 2;

  P.SECTIONS = [
    ['paste', 'COPY-READY PROMPT'],
    ['role', 'ASSIGNED EXPERT ROLE'],
    ['mission', 'MISSION'],
    ['context', 'RELEVANT PROJECT CONTEXT'],
    ['references', 'APPROVED VISUAL REFERENCES'],
    ['constraints', 'NON-NEGOTIABLE CONSTRAINTS'],
    ['specs', 'TECHNICAL SPECIFICATIONS'],
    ['instructions', 'DETAILED IMPLEMENTATION INSTRUCTIONS'],
    ['outputs', 'ASSET OUTPUT REQUIREMENTS'],
    ['validation', 'VALIDATION CHECKLIST'],
    ['acceptance', 'ACCEPTANCE TESTS'],
    ['recovery', 'FAILURE RECOVERY STEPS'],
    ['deliverables', 'FINAL DELIVERABLES'],
    ['questions', 'OPEN QUESTIONS (resolve before or during execution)'],
  ];
  P.REQUIRED = ['role', 'mission', 'context', 'constraints', 'instructions', 'validation', 'acceptance', 'deliverables'];

  /** item forms: "text" | {t, q} | {sub:"Heading", items:[...], q} | {code:"...", lang, q} */
  function filterItems(items, q) {
    const out = [];
    (items || []).forEach((it) => {
      if (it == null || it === '') return;
      if (typeof it === 'string') return out.push(it);
      if ((it.q || 1) > q) return;
      if (it.sub) {
        const inner = filterItems(it.items, q);
        if (inner.length) out.push({ sub: it.sub, items: inner });
      } else if (it.code != null) out.push({ code: it.code, lang: it.lang || '' });
      else if (it.t) out.push(it.t);
    });
    return out;
  }

  function renderItems(items, numbered) {
    const out = [];
    let n = 0;
    items.forEach((it) => {
      if (typeof it === 'string') {
        n++;
        out.push((numbered ? n + '. ' : '- ') + it);
      } else if (it.sub) {
        out.push('');
        out.push('### ' + it.sub);
        it.items.forEach((x) => {
          if (typeof x === 'string') out.push('- ' + x);
          else if (x.code != null) out.push('```' + x.lang + '\n' + x.code + '\n```');
        });
      } else if (it.code != null) {
        out.push('```' + it.lang + '\n' + it.code + '\n```');
      }
    });
    return out.join('\n');
  }

  const NUMBERED = { instructions: true, acceptance: true, recovery: true };

  /** Compile a generator spec into text. */
  P.compile = function (spec, quality, opts) {
    opts = opts || {};
    const q = typeof quality === 'number' ? quality : P.qLevel(quality);
    const parts = [];
    const sections = {};
    parts.push('# ' + spec.title);
    const metaLine = ['Target tool: ' + spec.toolLabel, 'Stage: ' + spec.stageLabel, 'Quality: ' + P.QUALITY_NAMES[q - 1].toUpperCase()];
    parts.push('> ' + metaLine.join(' · '));
    let idx = 0;
    P.SECTIONS.forEach(([key, heading]) => {
      const items = filterItems(spec.sections[key], q);
      if (!items.length) return;
      sections[key] = items;
      idx++;
      const h = key === 'paste' ? heading + ' — ' + spec.toolLabel.toUpperCase() : heading;
      parts.push('');
      parts.push('## ' + idx + '. ' + h);
      if (key === 'paste') {
        items.forEach((it) => {
          if (typeof it === 'string') parts.push(it);
          else if (it.code != null) parts.push('```' + it.lang + '\n' + it.code + '\n```');
          else if (it.sub) { parts.push('**' + it.sub + '**'); it.items.forEach((x) => parts.push(typeof x === 'string' ? x : '```\n' + x.code + '\n```')); }
        });
      } else parts.push(renderItems(items, !!NUMBERED[key]));
    });
    const text = parts.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
    const result = { title: spec.title, text, sections, tokens: U.estimateTokens(text), quality: q, spec };
    const limit = opts.maxTokens || spec.toolTokenLimit || 0;
    result.overLimit = !!(limit && result.tokens > limit);
    return result;
  };

  /** Split instruction groups into coordinated phases that each fit a token budget. */
  P.compilePhases = function (spec, quality, maxTokens, forcedCount) {
    const q = typeof quality === 'number' ? quality : P.qLevel(quality);
    const groups = filterItems(spec.sections.instructions, q);
    const subGroups = [];
    let loose = [];
    groups.forEach((g) => {
      if (typeof g === 'string') loose.push(g);
      else subGroups.push(g);
    });
    if (loose.length) subGroups.unshift({ sub: 'General instructions', items: loose });
    if (subGroups.length < 2) return null;
    const baseSpec = Object.assign({}, spec, { sections: Object.assign({}, spec.sections, { instructions: [] }) });
    const base = P.compile(baseSpec, q);
    let budget = Math.max(400, (maxTokens || 6000) - base.tokens);
    const phases = [];
    let cur = [], curTok = 0;
    const target = forcedCount ? Math.ceil(subGroups.length / forcedCount) : 0;
    subGroups.forEach((g) => {
      const t = U.estimateTokens(renderItems([g]));
      const full = target ? cur.length >= target : cur.length && curTok + t > budget;
      if (full) { phases.push(cur); cur = []; curTok = 0; }
      cur.push(g); curTok += t;
    });
    if (cur.length) phases.push(cur);
    if (phases.length < 2) return null;
    const N = phases.length;
    return phases.map((grp, i) => {
      const ps = Object.assign({}, spec, {
        title: spec.title + ' — Phase ' + (i + 1) + ' of ' + N,
        sections: Object.assign({}, spec.sections, {
          mission: (spec.sections.mission || []).concat([
            'This is PHASE ' + (i + 1) + ' of ' + N + ' of a coordinated execution plan. Scope of this phase: ' + grp.map((g) => g.sub).join('; ') + '.',
            i > 0 ? 'Assume phases 1–' + i + ' were completed and accepted. Do not redo or rewrite their work; build on it.' : 'Do not start later phases yet.',
            'At the end of this phase, stop, report what changed, list files touched, and confirm the phase acceptance checks before continuing.',
          ]),
          instructions: grp,
          deliverables: i === N - 1 ? spec.sections.deliverables : ['Phase ' + (i + 1) + ' report: summary of changes, files touched, checks run and their results, open issues for the next phase.'],
          questions: i === 0 ? spec.sections.questions : [],
        }),
      });
      return P.compile(ps, q);
    });
  };

  /** Expand: raise quality one level; at ULTRA also add assumption/risk/open-question appendices. */
  P.expand = function (spec, quality, project) {
    const q = typeof quality === 'number' ? quality : P.qLevel(quality);
    if (q < 3) return { result: P.compile(spec, q + 1), quality: q + 1, note: 'Expanded to ' + P.QUALITY_NAMES[q].toUpperCase() + ' detail.' };
    const extra = Object.assign({}, spec, { sections: Object.assign({}, spec.sections) });
    const qs = (spec.sections.questions || []).slice();
    if (project) A.context.openQuestions(project).forEach((x) => { if (!qs.includes(x)) qs.push(x); });
    qs.push('List every assumption you make in an "Assumption register" table (assumption · reason · how to verify).');
    qs.push('Produce a short risk table (risk · likelihood · impact · mitigation) before executing.');
    extra.sections.questions = qs;
    extra.sections.validation = (spec.sections.validation || []).concat([
      'Self-review pass: re-read every constraint above and confirm each one is satisfied in the output, citing where.',
    ]);
    return { result: P.compile(extra, 3), quality: 3, note: 'Already ULTRA: added assumption register, risk table and self-review pass.' };
  };

  /** Refine an edited prompt: normalise formatting, remove duplicate lines, restore missing required sections. */
  P.refine = function (text, opts) {
    opts = opts || {};
    const changes = [];
    let lines = String(text || '').replace(/\r\n/g, '\n').split('\n').map((l) => l.replace(/\s+$/, ''));
    // bullets: unify "*" / "•" to "-"
    let bulletFix = 0;
    lines = lines.map((l) => { const m = l.match(/^(\s*)[*•]\s+(.*)$/); if (m) { bulletFix++; return m[1] + '- ' + m[2]; } return l; });
    if (bulletFix) changes.push('Normalised ' + bulletFix + ' bullet marker(s).');
    // dedupe non-structural lines (outside code fences)
    const seen = new Set(); let inCode = false; let removed = 0;
    lines = lines.filter((l) => {
      if (/^```/.test(l)) { inCode = !inCode; return true; }
      if (inCode) return true;
      const key = l.replace(/^\s*(-|\d+\.)\s*/, '').trim().toLowerCase();
      if (!key || /^#/.test(l) || key.length < 12 || /:$/.test(key)) return true;
      if (seen.has(key)) { removed++; return false; }
      seen.add(key); return true;
    });
    if (removed) changes.push('Removed ' + removed + ' duplicated line(s).');
    let out = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    // restore missing required sections from compiled spec
    if (opts.compiled) {
      const missing = P.REQUIRED.filter((k) => opts.compiled.sections[k] && !new RegExp(P.SECTIONS.find((s) => s[0] === k)[1].replace(/[()]/g, '.'), 'i').test(out));
      missing.forEach((k) => {
        const heading = P.SECTIONS.find((s) => s[0] === k)[1];
        out += '\n\n## ' + heading + '\n' + renderItems(opts.compiled.sections[k], !!NUMBERED[k]);
        changes.push('Restored missing section: ' + heading + '.');
      });
    }
    if (U.has(opts.note)) {
      out += '\n\n## REVISION DIRECTIVE\n- ' + U.lines(opts.note).join('\n- ');
      changes.push('Appended revision directive.');
    }
    if (!changes.length) changes.push('No structural problems found; text unchanged.');
    return { text: out + '\n', changes };
  };

  /* ---------------- Correction / lint rules ---------------- */
  const MJ_PARAM_RE = /\s--(ar|v|niji|stylize|s|no|cref|cw|oref|ow|sref|sw|seed|style|chaos|tile|q|weird|raw)\b(\s+[^\s-][^\s]*)?/g;

  P.RULES = [
    {
      id: 'secret', severity: 'error',
      test: (t) => /(sk-ant-[A-Za-z0-9_-]{8,}|\bsk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,})/.test(t),
      msg: 'A secret/API key appears in the prompt. It has been redacted.',
      fix: (t) => t.replace(/(sk-ant-[A-Za-z0-9_-]{8,}|\bsk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,})/g, '[REDACTED-SECRET]'),
    },
    {
      id: 'placeholder', severity: 'error',
      test: (t) => /\[MISSING:[^\]]*\]|\bTODO\b|\bTBD\b|\[insert[^\]]*\]|lorem ipsum/i.test(t),
      msg: 'Unfilled placeholders (e.g. [MISSING: …], TODO, [insert …]). Fill the related project fields or edit the text.',
    },
    {
      id: 'false-analysis', severity: 'error',
      test: (t, c) => !c.anyAnalyzed && /\b(I|we|the studio) (have |has )?analy[sz]ed (the|your|this) (attached |uploaded )?(reference|image|file)s?/i.test(t),
      msg: 'Claims a reference was analysed, but no asset has an AI analysis on record.',
      fix: (t) => t.replace(/\b(I|we|the studio) (have |has )?analy[sz]ed (the|your|this) (attached |uploaded )?(reference|image|file)s?/gi, 'the written specification describes the $5'),
    },
    {
      id: 'false-model-claim', severity: 'warning',
      test: (t, c) => !c.aiGenerated && /\b(generated|produced|processed|invoked) (by|with|via) (claude )?(opus|sonnet|haiku|gpt|gemini)\b/i.test(t),
      msg: 'Text claims an AI model produced it, but this version was compiled locally.',
      fix: (t) => t.replace(/\b(generated|produced|processed|invoked) (by|with|via) (claude )?(opus|sonnet|haiku|gpt|gemini)\b/gi, 'compiled locally by the studio'),
    },
    {
      id: 'mj-params-wrong-tool', severity: 'warning',
      test: (t, c) => c.tool && c.tool !== 'midjourney' && c.category === 'image' && /\s--(ar|v|niji|stylize|no|cref|oref|sref)\b/.test(t),
      msg: 'Midjourney-style "--" parameters found in a prompt for a different tool; they would be read as literal text.',
      fix: (t) => t.replace(MJ_PARAM_RE, ''),
    },
    {
      id: 'mj-missing-ar', severity: 'warning',
      test: (t, c) => c.tool === 'midjourney' && !/--ar\s+\d+:\d+/.test(t),
      msg: 'Midjourney prompt has no --ar aspect ratio parameter.',
      fix: (t, c) => t.replace(/(```[^\n]*\n)([^`]+?)(\n```)/, (m, a, b, d) => a + b.trim() + ' --ar ' + (c.aspect || '1:1') + d),
    },
    {
      id: 'destructive-existing', severity: 'error',
      test: (t, c) => c.mode === 'existing' && /\b(rewrite|replace|recreate|rebuild) (the )?(entire|whole|full|complete) (game|project|codebase|engine)\b|\bfrom scratch\b/i.test(t) && !/never (rewrite|start) .*from scratch|do not (rewrite|rebuild|start).{0,40}from scratch/i.test(t),
      msg: 'Instruction would replace an existing working game. Existing-project prompts must request minimal changes.',
      fix: (t) => t.replace(/\b(rewrite|replace|recreate|rebuild) (the )?(entire|whole|full|complete) (game|project|codebase|engine)\b/gi, 'make the smallest safe change to the $4').replace(/\bfrom scratch\b/gi, 'incrementally on top of the existing code'),
    },
    {
      id: 'browser-apk', severity: 'error',
      test: (t) => /\b(browser|this (web )?app|the studio) (can |will )?(compile|build)s? (an |the )?(apk|aab)\b/i.test(t),
      msg: 'Claims a browser can compile an APK/AAB. Compilation requires a configured local or CI Android build environment.',
      fix: (t) => t.replace(/\b(browser|this (web )?app|the studio) (can |will )?(compile|build)s? (an |the )?(apk|aab)\b/gi, 'a configured Android build environment (Android Studio / Gradle, local or CI) compiles the $6'),
    },
    {
      id: 'clean-art', severity: 'warning',
      test: (t, c) => c.cleanArt && !/no (dialogue|text|lettering|speech bubbles)/i.test(t),
      msg: 'Clean-art option is on but the prompt has no "no text / no speech bubbles" constraint.',
      fix: (t) => t.trim() + '\n\n## CLEAN ART\n- No dialogue, no speech bubbles, no captions, no labels, no lettering, no watermarks.\n',
    },
    {
      id: 'character-lock', severity: 'warning',
      test: (t, c) => ['image', 'meshy', undefined].includes(c.category) && (c.characters || []).some((ch) => t.includes(ch.name) && !t.includes(ch.id)),
      msg: 'A registered character is mentioned without its continuity lock / ID.',
      fix: (t, c) => {
        let out = t.trim();
        (c.characters || []).filter((ch) => out.includes(ch.name) && !out.includes(ch.id)).forEach((ch) => {
          out += '\n\n' + A.context.characterLock(ch, 2).join('\n');
        });
        return out + '\n';
      },
    },
    {
      id: 'minor-safety', severity: 'error',
      test: (t, c) => (c.characters || []).some((ch) => A.schema.isMinor(ch) && t.includes(ch.name)) && !/non-sexualised/i.test(t),
      msg: 'A minor character appears without the age-appropriate / non-sexualised constraint.',
      fix: (t) => t.trim() + '\n- Age-appropriate depiction: fully clothed, non-sexualised, no suggestive poses or framing.\n',
    },
    {
      id: 'fill-in', severity: 'warning',
      test: (t) => /<(describe|paste|list)[^>\n]*>/i.test(t),
      msg: 'Template fill-in markers (<describe …>, <paste …>, <list …>) are still present; replace them before sending.',
    },
    {
      id: 'empty-section', severity: 'info',
      test: (t) => /^## [^\n]*\n\s*(?=## |(?![\s\S]))/m.test(t),
      msg: 'A section heading has no content.',
      fix: (t) => t.replace(/^## [^\n]*\n\s*(?=## |(?![\s\S]))/gm, ''),
    },
    {
      id: 'length', severity: 'warning',
      test: (t, c) => !!c.maxChars && P.firstCodeBlock(t).length > c.maxChars,
      msg: 'Copy-ready block may exceed the target tool limit; shorten it or split into phases.',
    },
    {
      id: 'duplicates', severity: 'info',
      test: (t) => { const l = t.split('\n').map((x) => x.trim()).filter((x) => x.length > 20 && !x.startsWith('#') && !x.startsWith('```') && !/:$/.test(x)); return new Set(l).size !== l.length; },
      msg: 'Duplicate lines detected.',
      fix: (t) => P.refine(t).text,
    },
  ];

  P.firstCodeBlock = (t) => (String(t).match(/```[^\n]*\n([\s\S]*?)\n```/) || [])[1] || '';

  /** Lint a prompt. ctx: {tool, category, mode, cleanArt, characters, anyAnalyzed, aiGenerated, aspect, maxChars} */
  P.lint = function (text, ctx) {
    ctx = ctx || {};
    return P.RULES.filter((r) => { try { return r.test(text, ctx); } catch (e) { return false; } })
      .map((r) => ({ id: r.id, severity: r.severity, message: r.msg, fixable: !!r.fix }));
  };

  P.correct = function (text, ctx) {
    ctx = ctx || {};
    let out = String(text || '');
    const applied = [];
    P.RULES.forEach((r) => {
      let hit = false;
      try { hit = r.test(out, ctx); } catch (e) { hit = false; }
      if (hit && r.fix) { out = r.fix(out, ctx); applied.push(r.id); }
    });
    return { text: out, applied, remaining: P.lint(out, ctx) };
  };
})(globalThis.AGPS = globalThis.AGPS || {});
