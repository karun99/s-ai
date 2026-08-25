/**
 * Artifacts (FR-W4) — PDF/DOCX/XLSX/MD writers + manifest.
 *
 * Zero dependencies:
 *   - MD   : native text
 *   - PDF  : minimal single/multi-page generator (Helvetica, xref table)
 *   - DOCX : WordprocessingML in a stored (uncompressed) ZIP
 *   - XLSX : SpreadsheetML in a stored ZIP
 * Every artifact directory gets a manifest.json with SHA-256 checksums
 * (verification pattern borrowed from 26zl/cybersec-toolkit release flow).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export type ArtifactKind = 'md' | 'pdf' | 'docx' | 'xlsx';

export interface WrittenArtifact { path: string; kind: ArtifactKind; sha256: string; bytes: number; }

/* --------------------------------- CRC32 ---------------------------------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Minimal ZIP writer (store method, no compression) — enough for DOCX/XLSX. */
export function zipStore(files: Array<{ name: string; data: Buffer | string }>): Buffer {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf8');
    const dataBuf = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8');
    const crc = crc32(dataBuf);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);          // version needed
    local.writeUInt16LE(0, 6);           // flags
    local.writeUInt16LE(0, 8);           // store
    local.writeUInt16LE(0, 10);          // time
    local.writeUInt16LE(0x2100 | ((new Date().getMonth() + 1) << 5) & 0xffff, 12); // date (approx)
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(dataBuf.length, 18);
    local.writeUInt32LE(dataBuf.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, dataBuf);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0, 8); cen.writeUInt16LE(0, 10);
    cen.writeUInt16LE(0, 12); cen.writeUInt16LE(0, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(dataBuf.length, 20);
    cen.writeUInt32LE(dataBuf.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    offset += local.length + nameBuf.length + dataBuf.length;
  }

  const centralSize = central.reduce((s, b) => s + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, ...central, end]);
}

/* --------------------------------- PDF ------------------------------------ */

function pdfEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7e\n]/g, '?');
}

/** Minimal valid multi-page PDF with wrapped Helvetica text. */
export function makePdf(title: string, body: string): Buffer {
  const lines: string[] = [title, '='.repeat(Math.min(60, title.length)), ''];
  for (const raw of body.split('\n')) {
    let line = raw;
    while (line.length > 92) {
      let cut = line.lastIndexOf(' ', 92);
      if (cut < 40) cut = 92;
      lines.push(line.slice(0, cut));
      line = line.slice(cut).trimStart();
    }
    lines.push(line);
  }
  const perPage = 48;
  const pages: string[][] = [];
  for (let i = 0; i < Math.max(1, Math.ceil(lines.length / perPage)); i++) {
    pages.push(lines.slice(i * perPage, (i + 1) * perPage));
  }

  const objects: string[] = [];
  const pageObjIds = pages.map((_, i) => 3 + i * 2);
  objects[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objects[2] = `<< /Type /Pages /Kids [${pageObjIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  pages.forEach((pageLines, i) => {
    const contentId = pageObjIds[i] + 1;
    objects[pageObjIds[i]] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${3 + pages.length * 2} 0 R >> >> >>`;
    const streamText = pageLines.map(l => `BT /F1 11 Tf 56 740 Td 14 TL (${pdfEscape(l)}) Tj T* ET`).join('\n');
    objects[contentId] = `<< /Length ${streamText.length} >>\nstream\n${streamText}\nendstream`;
  });
  const fontId = 3 + pages.length * 2;
  objects[fontId] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let id = 1; id <= fontId; id++) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id] || '<< >>'}\nendobj\n`;
  }
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${fontId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= fontId; id++) {
    pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${fontId + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

/* ------------------------------ DOCX / XLSX ------------------------------- */

export function makeDocx(title: string, body: string): Buffer {
  const paragraphs = [title, '', ...body.split('\n')]
    .map(t => `<w:p><w:r><w:t xml:space="preserve">${t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</w:t></w:r></w:p>`)
    .join('');
  return zipStore([
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>` },
    { name: 'word/document.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}</w:body></w:document>` }
  ]);
}

export interface XlsxSheet { name: string; rows: string[][]; }

export function makeXlsx(sheets: XlsxSheet[]): Buffer {
  const sheetXmls = sheets.map(sheet => {
    const rowsXml = sheet.rows.map((row, r) =>
      `<row r="${r + 1}">${row.map((cell, c) => `<c r="${String.fromCharCode(65 + (c % 26))}${r + 1}" t="inlineStr"><is><t>${cell.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</t></is></c>`).join('')}</row>`
    ).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData></worksheet>`;
  });
  const files: Array<{ name: string; data: Buffer | string }> = [
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${s.name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>` },
    ...sheetXmls.map((xml, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: xml }))
  ];
  return zipStore(files);
}

/* ------------------------------- manifest --------------------------------- */

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * Write a job's artifacts into `<artifactsRoot>/<jobId>/` with a manifest.
 * Supported kinds: md, pdf, docx, xlsx.
 */
export function writeArtifacts(
  artifactsRoot: string,
  jobId: string,
  title: string,
  content: string,
  kinds: ArtifactKind[]
): WrittenArtifact[] {
  const dir = join(artifactsRoot, jobId);
  mkdirSync(dir, { recursive: true });
  const written: WrittenArtifact[] = [];

  const push = (filename: string, buf: Buffer, kind: ArtifactKind): void => {
    writeFileSync(join(dir, filename), buf);
    written.push({ path: join(dir, filename), kind, sha256: sha256(buf), bytes: buf.length });
  };

  if (!kinds.length || kinds.includes('md')) push(`${jobId}.md`, Buffer.from(`# ${title}\n\n${content}\n`), 'md');
  if (kinds.includes('pdf')) push(`${jobId}.pdf`, makePdf(title, content), 'pdf');
  if (kinds.includes('docx')) push(`${jobId}.docx`, makeDocx(title, content), 'docx');
  if (kinds.includes('xlsx')) {
    const rows: string[][] = [['section', 'text']];
    content.split('\n').slice(0, 500).forEach((line, i) => rows.push([String(i + 1), line]));
    push(`${jobId}.xlsx`, makeXlsx([{ name: 'report', rows }]), 'xlsx');
  }

  const manifest = {
    job: jobId,
    title,
    generatedAt: new Date().toISOString(),
    artifacts: written.map(w => ({ file: w.path.split('/').pop(), kind: w.kind, sha256: w.sha256, bytes: w.bytes }))
  };
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return written;
}
