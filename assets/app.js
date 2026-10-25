/* يقرأ قائمة المواد من subjects.json (ينبني تلقائياً) ثم يحمّل كل مادة من مجلدها في subjects/<id>/
   لا تعدّل هذا الملف لإضافة مادة — شوف README.md */
(async function () {
  const OPTIONAL = ['notes.html', 'theory.json', 'truefalse.json', 'problems.json', 'quiz.json'];
  const main = document.getElementById('subjects');
  const nav = document.querySelector('nav.tabs');
  let ver = '';

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }
  };
  async function get(path, type) {
    const r = await fetch(path + (ver ? '?v=' + ver : ''));
    if (!r.ok) throw new Error(path + ' ' + r.status);
    return type === 'text' ? r.text() : r.json();
  }
  const tryGet = (path, type) => get(path, type).catch(() => null);

  // قائمة المواد: subjects.json من الـ build، وإذا ما وُجد نسأل GitHub API عن مجلد subjects
  async function listSubjects() {
    try {
      const m = await get('subjects.json');
      ver = m.built || '';
      return m.subjects;
    } catch (e) {}
    const host = location.hostname.match(/^([^.]+)\.github\.io$/);
    if (!host) throw new Error('subjects.json غير موجود. شغّل: node scripts/build.mjs');
    const repo = location.pathname.split('/').filter(Boolean)[0] || host[1] + '.github.io';
    const r = await fetch('https://api.github.com/repos/' + host[1] + '/' + repo + '/contents/subjects');
    if (!r.ok) throw new Error('ما قدرت أقرأ مجلد subjects');
    return (await r.json()).filter(f => f.type === 'dir' && !f.name.startsWith('_')).map(f => ({ id: f.name, files: OPTIONAL }));
  }

  async function loadSubject(s) {
    const base = 'subjects/' + s.id + '/';
    const has = f => s.files.includes(f);
    const [info, notes, theory, tf, problems, quiz] = await Promise.all([
      get(base + 'info.json'),
      has('notes.html') ? tryGet(base + 'notes.html', 'text') : null,
      has('theory.json') ? tryGet(base + 'theory.json') : null,
      has('truefalse.json') ? tryGet(base + 'truefalse.json') : null,
      has('problems.json') ? tryGet(base + 'problems.json') : null,
      has('quiz.json') ? tryGet(base + 'quiz.json') : null
    ]);
    return { id: s.id, info, notes, theory, tf, problems, quiz };
  }

  function head(sec, id, title, withScore) {
    const h2 = el('h2', null, title); h2.id = id;
    if (!withScore) { sec.appendChild(h2); return null; }
    const wrap = el('div', 'quiz-head');
    const right = el('span');
    const score = el('span', 'score', '0 / 0');
    const reset = el('button', 'reset', 'إعادة'); reset.type = 'button';
    right.append(score, ' ', reset);
    wrap.append(h2, right); sec.appendChild(wrap);
    return { score, reset };
  }

  function renderQuiz(box, list, score) {
    box.innerHTML = '';
    let right = 0;
    const upd = () => score.textContent = right + ' / ' + list.length;
    list.forEach((it, qi) => {
      const d = el('div', 'q');
      d.appendChild(el('p', null, (qi + 1) + '. ' + it.q));
      if (it.code) { const pre = el('pre'); pre.appendChild(el('code', null, it.code)); d.appendChild(pre); }
      const ops = el('div', 'opts');
      const why = el('div', 'why'); why.hidden = true;
      it.o.forEach((t, oi) => {
        const b = el('button', 'opt', t); b.type = 'button';
        if (/^[\x20-\x7E]+$/.test(t)) b.classList.add('ltr');
        b.addEventListener('click', () => {
          ops.querySelectorAll('button').forEach((x, xi) => { x.disabled = true; if (xi === it.a) x.classList.add('right'); });
          if (oi === it.a) right++; else b.classList.add('wrong');
          upd();
          why.innerHTML = '';
          why.append(el('b', null, oi === it.a ? 'صح. ' : 'خطأ. الجواب: ' + it.o[it.a] + '. '), it.w || '');
          why.hidden = false;
        });
        ops.appendChild(b);
      });
      d.append(ops, why); box.appendChild(d);
    });
    upd();
  }

  function renderTF(box, list, score) {
    box.innerHTML = '';
    let right = 0;
    const upd = () => score.textContent = right + ' / ' + list.length;
    list.forEach((it, i) => {
      const d = el('div', 'q');
      d.appendChild(el('p', null, (i + 1) + '. ' + it.s));
      const row = el('div', 'tf-row');
      const why = el('div', 'why'); why.hidden = true;
      [[true, 'صح'], [false, 'خطأ']].forEach(([val, lab]) => {
        const b = el('button', 'opt', lab); b.type = 'button'; b.dataset.v = val;
        b.addEventListener('click', () => {
          row.querySelectorAll('button').forEach(x => { x.disabled = true; if ((x.dataset.v === 'true') === it.t) x.classList.add('right'); });
          const ok = val === it.t; if (ok) right++; else b.classList.add('wrong');
          upd();
          why.innerHTML = '';
          why.append(el('b', null, ok ? 'إجابتك صحيحة. ' : 'إجابتك خاطئة. الصحيح: ' + (it.t ? 'صح' : 'خطأ') + '. '), it.w || '');
          why.hidden = false;
        });
        row.appendChild(b);
      });
      d.append(row, why); box.appendChild(d);
    });
    upd();
  }

  function renderTheory(sec, S) {
    head(sec, S.id + '-theory', 'أسئلة النظري');
    sec.appendChild(el('p', 'intro', 'جاوب في ذهنك أو على ورقة، بعدين افتح الإجابة وقارن. إذا عرفتها علّم "أعرفها"، ورجع للباقي قبل الاختبار.'));
    const prog = el('div', 'th-progress score');
    sec.appendChild(prog);
    const key = i => 'known-' + S.id + '-' + i;
    const upd = () => {
      const k = S.theory.filter((_, i) => store.get(key(i)) === '1').length;
      prog.textContent = 'تعرف ' + k + ' من ' + S.theory.length;
    };
    S.theory.forEach((it, i) => {
      const known = store.get(key(i)) === '1';
      const d = el('div', 'th' + (known ? ' known' : ''));
      const top = el('div', 'th-top');
      const lb = el('label');
      const cb = el('input'); cb.type = 'checkbox'; cb.checked = known;
      cb.addEventListener('change', () => { store.set(key(i), cb.checked ? '1' : null); d.classList.toggle('known', cb.checked); upd(); });
      lb.append(cb, 'أعرفها');
      top.append(el('p', null, (i + 1) + '. ' + it.q), lb);
      const det = el('details');
      const ul = el('ul');
      it.a.forEach(x => ul.appendChild(el('li', null, x)));
      det.append(el('summary', null, 'الإجابة'), ul);
      d.append(top, det); sec.appendChild(d);
    });
    upd();
  }

  function renderProblems(sec, S) {
    const P = S.problems, tags = P.tags || {};
    head(sec, S.id + '-problems', P.title || 'مسائل للحل');
    if (P.intro) sec.appendChild(el('p', null, P.intro));
    const fb = el('div', 'filter'); fb.setAttribute('role', 'group');
    const box = el('div', 'probs');
    sec.append(fb, box);
    let filter = 'all';
    const draw = () => {
      fb.innerHTML = ''; box.innerHTML = '';
      [['all', 'الكل'], ...Object.entries(tags)].forEach(([k, l]) => {
        const b = el('button', null, l); b.type = 'button';
        b.setAttribute('aria-pressed', String(filter === k));
        b.addEventListener('click', () => { filter = k; draw(); });
        fb.appendChild(b);
      });
      P.items.forEach((p, i) => {
        if (filter !== 'all' && !(p.tags || []).includes(filter)) return;
        const d = el('div', 'prob');
        const h = el('h3', null, 'مسألة ' + (i + 1) + ': ' + p.t);
        if (p.lvl) h.appendChild(el('span', 'lvl', 'مثل ' + p.lvl));
        d.appendChild(h);
        p.q.split('\n').forEach(line => d.appendChild(el('p', null, line)));
        if (p.tags && p.tags.length) {
          const nd = el('div', 'needs', 'تحتاج:');
          p.tags.forEach(t => nd.appendChild(el('span', 'tag', tags[t] || t)));
          d.appendChild(nd);
        }
        const ta = el('textarea'); ta.spellcheck = false;
        ta.placeholder = P.codePlaceholder || '// اكتب حلك هنا';
        const dk = 'prob-draft-' + S.id + '-' + i;
        ta.value = store.get(dk) || '';
        ta.addEventListener('input', () => store.set(dk, ta.value));
        d.appendChild(ta);
        if (p.h) {
          const dh = el('details');
          dh.append(el('summary', null, 'تلميح'), el('p', null, p.h));
          d.appendChild(dh);
        }
        const ds = el('details'); const pre = el('pre');
        pre.appendChild(el('code', null, p.s));
        ds.append(el('summary', null, 'الحل'), pre);
        d.appendChild(ds);
        box.appendChild(d);
      });
    };
    draw();
  }

  function renderSubject(S) {
    const sec = el('section', 'subject');
    sec.id = S.id; sec.dataset.s = S.id; sec.hidden = true;
    sec.setAttribute('role', 'tabpanel');
    const toc = el('div', 'toc');
    sec.appendChild(toc);
    if (S.notes) {
      const notes = el('div', 'notes');
      notes.innerHTML = S.notes;
      sec.appendChild(notes);
    }
    if (S.theory && S.theory.length) renderTheory(sec, S);
    if (S.tf && S.tf.length) {
      const h = head(sec, S.id + '-tf', 'صح أو خطأ', true);
      const box = el('div'); sec.appendChild(box);
      const go = () => renderTF(box, S.tf, h.score);
      h.reset.addEventListener('click', go); go();
    }
    if (S.problems && S.problems.items && S.problems.items.length) renderProblems(sec, S);
    if (S.quiz && S.quiz.length) {
      const h = head(sec, S.id + '-quiz', 'اختبر نفسك: ' + (S.info.short || S.info.title), true);
      const box = el('div', 'quiz'); sec.appendChild(box);
      const go = () => renderQuiz(box, S.quiz, h.score);
      h.reset.addEventListener('click', go); go();
    }
    // فهرس تلقائي من عناوين h2
    sec.querySelectorAll('h2').forEach((h2, i) => {
      if (!h2.id) h2.id = S.id + '-s' + i;
      const a = el('a', null, h2.dataset.toc || h2.childNodes[0].textContent.trim());
      a.href = '#' + h2.id;
      toc.appendChild(a);
    });
    return sec;
  }

  try {
    const [site, list] = await Promise.all([tryGet('site.json'), listSubjects()]);
    if (site) {
      document.title = site.title;
      document.getElementById('site-title').textContent = site.title;
      document.getElementById('site-sub').textContent = site.subtitle || '';
      document.getElementById('site-footer').textContent = site.footer || '';
    }
    const results = await Promise.allSettled(list.map(loadSubject));
    const subjects = results.filter(r => r.status === 'fulfilled').map(r => r.value);
    results.filter(r => r.status === 'rejected').forEach(r => console.error(r.reason));
    subjects.sort((a, b) => (a.info.order ?? 999) - (b.info.order ?? 999) || a.info.title.localeCompare(b.info.title, 'ar'));
    if (!subjects.length) throw new Error('ما فيه مواد في مجلد subjects');

    main.innerHTML = '';
    const tabs = subjects.map(S => {
      const style = '--c-light:' + (S.info.color || '#1f5fbf') + (S.info.colorDark ? ';--c-dark:' + S.info.colorDark : '');
      const t = el('button', null, S.info.title);
      t.type = 'button'; t.dataset.s = S.id; t.id = 'tab-' + S.id;
      t.setAttribute('role', 'tab'); t.setAttribute('style', style);
      nav.appendChild(t);
      const sec = renderSubject(S);
      sec.setAttribute('style', style); sec.setAttribute('aria-labelledby', t.id);
      main.appendChild(sec);
      return t;
    });

    const ids = subjects.map(S => S.id);
    const show = (s, save) => {
      tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.s === s)));
      main.querySelectorAll('section.subject').forEach(sec => sec.hidden = sec.id !== s);
      if (save) store.set('tab', s);
    };
    tabs.forEach(t => t.addEventListener('click', () => { show(t.dataset.s, true); history.replaceState(null, '', '#' + t.dataset.s); window.scrollTo({ top: 0 }); }));
    main.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      const target = a && document.getElementById(a.getAttribute('href').slice(1));
      if (target) { e.preventDefault(); target.scrollIntoView(); }
    });

    const h = decodeURIComponent(location.hash.slice(1));
    const target = h && document.getElementById(h);
    const owner = target && target.closest('section.subject');
    let start = owner ? owner.id : (ids.includes(store.get('tab')) ? store.get('tab') : ids[0]);
    show(start, false);
    if (owner && target !== owner) target.scrollIntoView();
  } catch (err) {
    main.innerHTML = '';
    main.appendChild(el('p', 'state err', 'صار خطأ في التحميل: ' + err.message));
  }
})();
