/**
 * Ingest — turn any pile of files and folders into clean, line-numbered text.
 *
 * Accepts any mix of individual files and directories (walked recursively).
 * Every returned document carries its own lines[] with 1-based line numbers so
 * every downstream finding can cite an exact line.
 *
 * HONESTY GUARANTEE: a file we cannot read as text is never silently dropped.
 * It is returned with readable=false and a plain-English reason, so the human
 * reviewer always sees "this file could not be read — review it manually"
 * rather than the tool pretending it wasn't there.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname, basename, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const SKIP_NAMES = new Set(['.DS_Store', 'Thumbs.db', '.git', 'node_modules']);
const MAX_FILE_BYTES = 30 * 1024 * 1024; // 30MB guard

/**
 * @typedef {Object} IngestedDoc
 * @property {string} path         absolute path
 * @property {string} relPath      path relative to the ingest root
 * @property {string} fileName
 * @property {string} ext          lowercase, no dot
 * @property {boolean} readable
 * @property {string[]} lines       machine-readable text, one entry per line (1-based via index+1)
 * @property {number} charCount
 * @property {string|null} warning  human-readable reason if not fully readable
 */

/** Recursively collect every file under the given paths. */
async function collectFiles(inputPaths) {
  const files = [];
  const roots = [];
  for (const p of inputPaths) {
    const abs = resolve(p);
    let st;
    try {
      st = await stat(abs);
    } catch {
      files.push({ abs, root: abs, missing: true });
      continue;
    }
    if (st.isDirectory()) {
      roots.push(abs);
      await walk(abs, abs, files);
    } else {
      roots.push(abs);
      files.push({ abs, root: abs, missing: false });
    }
  }
  return { files, roots };
}

async function walk(dir, root, out) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const e of entries) {
    if (SKIP_NAMES.has(e.name) || e.name.startsWith('~$')) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) await walk(full, root, out);
    else out.push({ abs: full, root, missing: false });
  }
}

function toLines(text) {
  // Normalise newlines, keep every line (including blanks) so numbering is true.
  return text.replace(/\r\n?/g, '\n').split('\n');
}

async function extractDocx(buf) {
  const mammoth = require('mammoth');
  const { value } = await mammoth.extractRawText({ buffer: buf });
  return value;
}

async function extractPdf(buf) {
  // Import the library entry directly to avoid its debug-mode test harness.
  const pdfParse = require('pdf-parse/lib/pdf-parse.js');
  const data = await pdfParse(buf);
  return data.text;
}

/**
 * Ingest a list of paths (files and/or folders).
 * @returns {Promise<{ root: string, roots: string[], docs: IngestedDoc[] }>}
 */
export async function ingest(inputPaths) {
  const { files, roots } = await collectFiles(inputPaths);
  const root = roots[0] ?? process.cwd();
  const docs = [];

  for (const f of files) {
    const fileName = basename(f.abs);
    const ext = extname(f.abs).slice(1).toLowerCase();
    const rel = f.abs.startsWith(f.root)
      ? f.abs.slice(f.root.length).replace(/^[/\\]/, '') || fileName
      : fileName;

    const base = {
      path: f.abs,
      relPath: rel,
      fileName,
      ext,
      readable: false,
      lines: [],
      charCount: 0,
      warning: null,
    };

    if (f.missing) {
      docs.push({ ...base, warning: 'File or folder not found at this path.' });
      continue;
    }

    let size = 0;
    try {
      size = (await stat(f.abs)).size;
    } catch {
      /* ignore */
    }
    if (size > MAX_FILE_BYTES) {
      docs.push({ ...base, warning: `File is larger than 30MB (${Math.round(size / 1e6)}MB) — skipped for safety. Split or review manually.` });
      continue;
    }

    try {
      let text = '';
      if (ext === 'docx') {
        text = await extractDocx(await readFile(f.abs));
      } else if (ext === 'pdf') {
        text = await extractPdf(await readFile(f.abs));
        if (!text.trim()) {
          docs.push({
            ...base,
            warning:
              'PDF contains no extractable text — it is likely a scanned image. This document must be read by a human; the tool cannot verify its contents.',
          });
          continue;
        }
      } else if (['txt', 'md', 'csv', 'text', 'log', 'rtf'].includes(ext)) {
        text = await readFile(f.abs, 'utf8');
        if (ext === 'rtf') text = stripRtf(text);
      } else if (ext === 'doc') {
        docs.push({
          ...base,
          warning:
            'Legacy .doc format cannot be read reliably. Convert to .docx or PDF and re-run. Not verified.',
        });
        continue;
      } else if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'tif', 'tiff', 'heic'].includes(ext)) {
        docs.push({
          ...base,
          warning:
            'Image file — evidence cannot be machine-read. Requires human review to confirm its contents.',
        });
        continue;
      } else if (['xlsx', 'xls'].includes(ext)) {
        docs.push({
          ...base,
          warning:
            'Spreadsheet — this reader assesses narrative policy text, not tabular registers. Review the spreadsheet manually against the relevant checklist item.',
        });
        continue;
      } else {
        docs.push({ ...base, warning: `Unsupported file type ".${ext}". Not read.` });
        continue;
      }

      const lines = toLines(text);
      docs.push({
        ...base,
        readable: true,
        lines,
        charCount: text.length,
        warning: text.trim().length < 40 ? 'Very little text extracted — check the source document.' : null,
      });
    } catch (e) {
      docs.push({
        ...base,
        warning: `Could not read this file (${(e && e.message) || 'unknown error'}). Review it manually.`,
      });
    }
  }

  return { root, roots, docs };
}

/** Minimal RTF-to-text so plain RTF exports are still readable. */
function stripRtf(rtf) {
  return rtf
    .replace(/\\par[d]?/g, '\n')
    .replace(/\{\\[^{}]*\}/g, '')
    .replace(/\\'[0-9a-f]{2}/gi, ' ')
    .replace(/\\[a-z]+-?\d* ?/gi, '')
    .replace(/[{}]/g, '')
    .trim();
}
