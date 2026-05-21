const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ── Server-controlled MIME → extension map ─────────────────────────────────
// The saved filename is derived exclusively from this map (plus a random UUID),
// so no user-supplied data ever flows into any file-system path.
const MIME_TO_EXT = new Map([
  ['application/pdf', '.pdf'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['application/msword', '.doc'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
]);

// Allowed file extensions and their corresponding MIME types.
// Both extension (from originalname) AND MIME type must match — two independent
// client-supplied checks.  Magic-byte validation runs server-side afterwards.
const ALLOWED_BY_EXT = {
  '.pdf':  ['application/pdf'],
  '.jpg':  ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png':  ['image/png'],
  '.doc':  ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    // Extension comes from the server-controlled MIME map — never from originalname.
    const ext = MIME_TO_EXT.get(file.mimetype) || '';
    cb(null, crypto.randomUUID() + ext);
  },
});

const fileFilter = (req, file, cb) => {
  // Validate declared extension (from originalname) against MIME type.
  // Use path.basename to strip any path separators embedded in originalname.
  const ext = path.extname(path.basename(file.originalname)).toLowerCase();
  const allowedMimes = ALLOWED_BY_EXT[ext];
  if (!allowedMimes) {
    return cb(new Error('Invalid file type. Allowed: PDF, JPG, PNG, DOC, DOCX'), false);
  }
  if (!allowedMimes.includes(file.mimetype)) {
    return cb(new Error('File extension and MIME type do not match'), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// ── Magic-bytes signatures ─────────────────────────────────────────────────
const SIGNATURES = {
  '.pdf':  Buffer.from([0x25, 0x50, 0x44, 0x46]),
  '.jpg':  Buffer.from([0xFF, 0xD8, 0xFF]),
  '.jpeg': Buffer.from([0xFF, 0xD8, 0xFF]),
  '.png':  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
};

// ── safeDeleteFile ─────────────────────────────────────────────────────────
// Accepts the bare server-generated filename (e.g. req.file.filename or
// path.basename(storedUrl)).  The full path is built entirely from the
// server-controlled uploadDir, so no user data flows into any fs call.
const safeDeleteFile = (serverFilename) => {
  if (!serverFilename) return;
  try {
    fs.unlinkSync(path.join(uploadDir, path.basename(serverFilename)));
  } catch {
    // File already gone or inaccessible — ignore
  }
};

// ── validateMagicBytes ─────────────────────────────────────────────────────
// serverFilename — bare server-generated filename (req.file.filename)
// originalname   — user-supplied original name, used ONLY for extension lookup
//                  in a static in-memory map; it never flows into a file path.
const validateMagicBytes = (serverFilename, originalname) => {
  const ext = path.extname(path.basename(originalname)).toLowerCase();
  const expected = SIGNATURES[ext];
  if (!expected) return true; // .doc / .docx are container formats — skip

  // Path is assembled from server-controlled components only
  const filePath = path.join(uploadDir, path.basename(serverFilename));

  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(expected.length);
    fs.readSync(fd, buf, 0, expected.length, 0);
    fs.closeSync(fd);
    if (!buf.equals(expected)) {
      safeDeleteFile(serverFilename);
      return false;
    }
    return true;
  } catch {
    safeDeleteFile(serverFilename);
    return false;
  }
};

module.exports = upload;
module.exports.validateMagicBytes = validateMagicBytes;
module.exports.safeDeleteFile = safeDeleteFile;
