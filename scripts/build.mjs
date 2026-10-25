// يبني subjects.json من مجلدات subjects/ ويتحقق من صحة ملفات كل مادة.
// تشغيل: node scripts/build.mjs   (GitHub Actions يشغله تلقائياً عند كل رفع)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'subjects');
const FILES = ['notes.html', 'theory.json', 'truefalse.json', 'problems.json', 'quiz.json'];
const errors = [];
const err = (id, msg) => errors.push(`subjects/${id}: ${msg}`);
const read = (id, f) => {
  try { return JSON.parse(fs.readFileSync(path.join(dir, id, f), 'utf8')); }
  catch (e) { err(id, `${f} ليس JSON صحيح (${e.message})`); return null; }
};

const subjects = [];
for (const id of fs.readdirSync(dir).sort()) {
  if (id.startsWith('_') || id.startsWith('.') || !fs.statSync(path.join(dir, id)).isDirectory()) continue;
  if (!/^[a-z0-9-]+$/.test(id)) err(id, 'اسم المجلد لازم يكون حروف إنجليزية صغيرة وأرقام و - فقط');
  if (!fs.existsSync(path.join(dir, id, 'info.json'))) { err(id, 'info.json مفقود'); continue; }
  const info = read(id, 'info.json');
  if (info && !info.title) err(id, 'info.json لازم فيه title');
  const files = FILES.filter(f => fs.existsSync(path.join(dir, id, f)));

  if (files.includes('quiz.json')) (read(id, 'quiz.json') || []).forEach((q, i) => {
    if (!q.q || !Array.isArray(q.o) || !Number.isInteger(q.a) || q.a < 0 || q.a >= q.o.length)
      err(id, `quiz.json سؤال ${i + 1}: لازم q و o (قائمة) و a (رقم الخيار الصحيح يبدأ من 0)`);
  });
  if (files.includes('truefalse.json')) (read(id, 'truefalse.json') || []).forEach((q, i) => {
    if (!q.s || typeof q.t !== 'boolean') err(id, `truefalse.json عبارة ${i + 1}: لازم s و t (true/false)`);
  });
  if (files.includes('theory.json')) (read(id, 'theory.json') || []).forEach((q, i) => {
    if (!q.q || !Array.isArray(q.a)) err(id, `theory.json سؤال ${i + 1}: لازم q و a (قائمة)`);
  });
  if (files.includes('problems.json')) {
    const p = read(id, 'problems.json');
    if (p && !Array.isArray(p.items)) err(id, 'problems.json لازم فيه items (قائمة)');
    (p?.items || []).forEach((x, i) => { if (!x.t || !x.q || !x.s) err(id, `problems.json مسألة ${i + 1}: لازم t و q و s`); });
  }
  if (files.includes('notes.html')) {
    const html = fs.readFileSync(path.join(dir, id, 'notes.html'), 'utf8');
    if (/<(html|head|body|script)\b/i.test(html)) err(id, 'notes.html لازم يكون جزء HTML فقط (بدون html/head/body/script)');
  }
  subjects.push({ id, files });
}

if (errors.length) { console.error('أخطاء:\n' + errors.join('\n')); process.exit(1); }
fs.writeFileSync(path.join(root, 'subjects.json'), JSON.stringify({ built: Date.now().toString(36), subjects }, null, 1) + '\n');
console.log('subjects.json:', subjects.map(s => s.id).join(', '));
