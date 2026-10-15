// Parsing file upload di browser untuk fitur "Isi Biodata dari Excel (AI)".
// - .xlsx / .xls / .csv → SheetJS (vendored, dimuat lewat <script> dari /vendor)
// - .docx              → fflate (vendored, dibundle) + ekstraksi tabel dari document.xml
// - .doc (Word biner)  → diparse di server (backend/api/docparse.php)
// Return: { headers: string[], rows: string[][], sheetName?: string }

import { unzipSync, strFromU8 } from '../vendor/fflate-0.8.2.mjs';

let xlsxPromise = null;
function loadSheetJs() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!xlsxPromise) {
    xlsxPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'vendor/xlsx.full.min.js';
      s.onload = () => (window.XLSX ? resolve(window.XLSX) : reject(new Error('Pustaka pembaca Excel gagal dimuat.')));
      s.onerror = () => reject(new Error('Pustaka pembaca Excel gagal dimuat.'));
      document.head.appendChild(s);
    });
  }
  return xlsxPromise;
}

function cellText(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/\s+/g, ' ').trim();
}

function cleanTable(headers, rows) {
  const hs = (headers || []).map(cellText);
  // Buang kolom paling kanan yang seluruhnya kosong (sering terjadi di file Word).
  let width = hs.length;
  while (width > 1 && rows.every((r) => cellText(r[width - 1]) === '')) width--;
  const hs2 = hs.slice(0, width);
  const rs = rows
    .map((r) => Array.from({ length: width }, (_, i) => cellText(r[i])))
    .filter((r) => r.some((c) => c !== ''));
  return { headers: hs2, rows: rs };
}

async function parseSpreadsheet(buffer) {
  const XLSX = await loadSheetJs();
  const wb = XLSX.read(buffer, { type: 'array' });
  // Pakai sheet pertama yang punya isi.
  let best = null;
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
    if (aoa.length > (best?.aoa.length || 0)) best = { name, aoa };
  }
  if (!best || best.aoa.length === 0) {
    throw new Error('Sheet kosong — tidak ada data yang bisa dibaca.');
  }
  // Baris header = baris pertama yang punya >= 2 sel terisi.
  let headerIdx = best.aoa.findIndex((r) => r.filter((c) => cellText(c) !== '').length >= 2);
  if (headerIdx === -1) headerIdx = 0;
  const headers = best.aoa[headerIdx] || [];
  const rows = best.aoa.slice(headerIdx + 1);
  const cleaned = cleanTable(headers, rows);
  return { ...cleaned, sheetName: best.name };
}

function parseDocxTables(xml) {
  // Buang tabel bersarang (innermost dulu) agar tiap baris terbaca sekali.
  let prev = xml;
  let xmlClean = xml;
  const nested = /<w:tbl>(?:(?!<w:tbl>|<\/w:tbl>)[\s\S])*<\/w:tbl>/;
  while (nested.test(xmlClean)) {
    xmlClean = xmlClean.replace(nested, '');
    if (xmlClean === prev) break;
    prev = xmlClean;
  }
  const rows = [];
  const trRe = /<w:tr[ >][\s\S]*?<\/w:tr>/g;
  const tcRe = /<w:tc[ >][\s\S]*?<\/w:tc>/g;
  const tRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  for (const tr of xmlClean.match(trRe) || []) {
    const cells = [];
    for (const tc of tr.match(tcRe) || []) {
      let text = '';
      for (const m of tc.matchAll(tRe)) text += m[1];
      cells.push(
        text
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, ' ')
          .trim(),
      );
    }
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

async function parseDocx(buffer) {
  let files;
  try {
    files = unzipSync(new Uint8Array(buffer));
  } catch {
    throw new Error('File .docx tidak dapat dibaca (bukan arsip Word yang valid).');
  }
  const doc = files['word/document.xml'];
  if (!doc) {
    throw new Error('File .docx tidak berisi dokumen Word yang valid.');
  }
  const xml = strFromU8(doc);
  const rows = parseDocxTables(xml);
  if (rows.length === 0) {
    throw new Error('Tidak menemukan tabel di dokumen Word. Pastikan data personel berbentuk tabel, atau simpan ulang sebagai .xlsx.');
  }
  // Baris header = baris pertama dengan >= 2 sel terisi.
  let headerIdx = rows.findIndex((r) => r.filter((c) => c !== '').length >= 2);
  if (headerIdx === -1) headerIdx = 0;
  return cleanTable(rows[headerIdx], rows.slice(headerIdx + 1));
}

export async function parseUploadFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const buffer = await file.arrayBuffer();

  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
    return parseSpreadsheet(buffer);
  }
  if (ext === 'docx') {
    return parseDocx(buffer);
  }
  throw new Error(
    'Format file belum didukung. Gunakan .xlsx, .xls, .csv, .docx, atau .doc (Word lama diproses otomatis di server).',
  );
}

// ===== Tebakan awal pemetaan kolom (boleh dikoreksi admin di langkah mapping) =====
// nameCol: kolom Nama Lengkap (kunci pencocokan).
// idCol:   kolom pertama yang terdeteksi berisi No. HP / NRP / nomor induk —
//          hanya sebagai saran target awal; admin bebas memetakan ke mana pun.

const RANK_TOKEN =
  /(AKP|AKBP|KOMPOL|KOMBES|BRIGJEN|IRMAYA|IRMAYUM|IRJEN|JEND|IPDA|IPDP|IPTU|AIKMADAN|AIPTU|AIPDA|BRIPTU|BRIPTU|ERPAN|PAMA|PENDA|PENDAM|POL|POLRI|NRPK|SAMAPTA|SIDIK|RESERSE|TAM|SARJAN)/i;

export function guessColumns(headers, rows) {
  const sample = rows.slice(0, 40);
  const colStats = (headers || []).map((_, ci) => {
    const vals = sample.map((r) => cellText(r[ci])).filter((v) => v !== '');
    const filled = vals.length;
    const nameLike = vals.filter((v) => /^[A-Za-z\u00C0-\u024F.' ,/-]+$/.test(v) && v.split(/\s+/).length >= 2).length;
    const rankLike = vals.filter((v) => RANK_TOKEN.test(v) || /^(PTU|PT|IP|BRIP|AIP)[A-Z.]*$/i.test(v)).length;
    const numeric = vals.filter((v) => /^[\d\s./-]+$/.test(v)).length;
    return { filled, nameLike, rankLike, numeric, total: Math.max(1, filled) };
  });

  let nameCol = -1;
  let nameScore = 0;
  let rankCol = -1;
  let rankScore = 0;

  colStats.forEach((s, ci) => {
    const h = (headers[ci] || '').toLowerCase();
    let ns = (s.nameLike / s.total) * 100;
    if (/nama|name|personel/.test(h)) ns += 40;
    if (nameCol === -1 || ns > nameScore) {
      nameScore = ns;
      nameCol = ci;
    }
    let rs = (s.rankLike / s.total) * 100;
    if (/pangkat|rank|grade/.test(h)) rs += 60;
    if (rs > rankScore && ci !== nameCol) {
      rankScore = rs;
      rankCol = ci;
    }
  });

  // Kolom rank tidak boleh sama dengan kolom nama; pilih kandidat terbaik lain bila perlu.
  if (rankCol === nameCol) {
    let alt = -1;
    let altScore = -1;
    colStats.forEach((s, ci) => {
      if (ci === nameCol) return;
      const sc = (s.rankLike / s.total) * 100 + (/(pangkat|rank)/i.test(headers[ci] || '') ? 60 : 0);
      if (sc > altScore) {
        altScore = sc;
        alt = ci;
      }
    });
    rankCol = alt;
  }

  // Saran kolom ID/nomor (No. HP, NRP, dsb.) — kolom paling numerik yang
  // bukan nama. Hanya sebagai pilihan awal di dropdown mapping.
  let idCol = -1;
  let idScore = 0;
  colStats.forEach((s, ci) => {
    if (ci === nameCol) return;
    const sc = (s.numeric / s.total) * 100 + (/hp|telpon|telepon|phone|nrp|nip|no\s*\.?\s*induk|id$/i.test(headers[ci] || '') ? 40 : 0);
    if (sc > idScore) {
      idScore = sc;
      idCol = ci;
    }
  });

  return {
    nameCol,
    rankCol,
    idCol: idScore >= 50 ? idCol : -1,
  };
}
