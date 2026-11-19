// الطباعة الرسمية بترويسة الجمهورية العربية السورية — كما في نموذج مديرية مالية اللاذقية
import eagleUrl from '../assets/eagle-gold.png?inline';

export interface OfficialPrintData {
  date: string;          // ISO
  number: string;
  senderSection: string; // اسم قسم المرسل — فارغ إذا كان مدير المالية أو مدير النظام
  senderIsDirector: boolean;
  fromLine: string;      // اسم المرسل كما سيظهر في سطر «من»
  toLine: string;        // اسم المستلم كما سيظهر في سطر «إلى»
  subject: string;
  body: string;
}

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nl2br(s: string): string {
  return esc(s).replace(/\r?\n/g, '<br/>');
}

function fullArabicDate(iso: string): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleDateString('ar-SY-u-nu-latn', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return d.toLocaleDateString('ar-SY', { year: 'numeric', month: 'long', day: 'numeric' });
  }
}

export function printOfficialLetter(data: OfficialPrintData): void {
  const dateLine = fullArabicDate(data.date);
  const numberLine = esc(data.number || '—');
  const fromLine = esc(data.fromLine || 'مدير مالية اللاذقية');
  const toLine = esc(data.toLine || 'مدير مالية اللاذقية');

  // سطر القسم في الترويسة: يظهر فقط إذا كان المرسل منتمياً إلى قسم
  const sectionLine = data.senderSection && !data.senderIsDirector
    ? `<div class="hd-line">قسم ${esc(data.senderSection)}</div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<title>كتاب رسمي — ${data.number || ''}</title>
<style>
  @page { size: A4; margin: 10mm 12mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Traditional Arabic', 'Amiri', 'Simplified Arabic', 'Times New Roman', serif;
    color: #1a1a1a; background: #fff;
  }
  .letterhead {
    display: flex; align-items: center; justify-content: space-between;
    padding: 4px 6px 8px;
  }
  .hd-ar { text-align: right; }
  .hd-en { text-align: left; direction: ltr; }
  .hd-line { font-size: 17px; font-weight: bold; line-height: 1.55; color: #14432f; }
  .hd-en .hd-line { font-family: 'Georgia', 'Times New Roman', serif; font-size: 15px; color: #14432f; }
  .hd-eagle { flex: 0 0 auto; text-align: center; }
  .hd-eagle img { height: 92px; width: auto; }
  .rule {
    border-bottom: 3px double #14432f;
    margin: 4px 0 18px;
  }
  .meta { font-size: 16px; line-height: 2.05; margin-bottom: 10px; }
  .meta .lbl { font-weight: bold; }
  .party { display: flex; gap: 6px; }
  .party .side { flex: 1; }
  .subj { font-size: 17px; font-weight: bold; margin: 12px 0 16px; }
  .subj .lbl { text-decoration: underline; }
  .body-text { font-size: 17px; line-height: 2.1; text-align: justify; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="letterhead">
    <div class="hd-ar">
      <div class="hd-line">الجمهورية العربية السورية</div>
      <div class="hd-line">وزارة المالية</div>
      <div class="hd-line">مديرية مالية محافظة اللاذقية</div>
      ${sectionLine}
      <div class="hd-line">المداولات</div>
    </div>
    <div class="hd-eagle">
      <img src="${eagleUrl}" alt="شعار الجمهورية العربية السورية" />
    </div>
    <div class="hd-en">
      <div class="hd-line">Syrian Arab Republic</div>
      <div class="hd-line">Ministry of Finance</div>
      <div class="hd-line">Lattakia Finance Directorate</div>
    </div>
  </div>
  <div class="rule"></div>

  <div class="meta">
    <div><span class="lbl">التاريخ:</span> ${dateLine}</div>
    <div><span class="lbl">الرقم:</span> ${numberLine}</div>
    <div class="party">
      <div class="side"><span class="lbl">من:</span> ${fromLine}</div>
      <div class="side"><span class="lbl">إلى:</span> ${toLine}</div>
    </div>
    <div class="subj"><span class="lbl">الموضوع:</span> ${esc(data.subject || '')}</div>
  </div>

  <div class="body-text">${nl2br(data.body || '')}</div>

  <script>window.onload = function () { setTimeout(function () { window.print(); }, 250); };<\/script>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=900,height=950');
  if (!w) {
    alert('تعذّر فتح نافذة الطباعة — اسمح بالنوافذ المنبثقة لهذا الموقع');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
