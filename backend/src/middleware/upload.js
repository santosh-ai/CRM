const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // Use only the basename then extract the extension to prevent any path
    // traversal via a crafted originalname (e.g. "../../../../etc/passwd.pdf")
    const ext = path.extname(path.basename(file.originalname)).toLowerCase();
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

// Allowed file extensions and their corresponding MIME types.
// Both extension AND MIME type must match — this provides two independent
// client-supplied checks. Magic-byte validation is enforced server-side
// (see validateMagicBytes below) for an additional layer of defence.
const ALLOWED = {
  '.pdf':  ['application/pdf'],
  '.jpg':  ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png':  ['image/png'],
  '.doc':  ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
};

const fileFilter = (req, file, cb) => {
  // Use only the basename's extension to prevent path-traversal via originalname
  const ext = path.extname(path.basename(file.originalname)).toLowerCase();
  const allowedMimes = ALLOWED[ext];
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

// ── Magic-bytes validation (call after multer saves the file) ──────────────────
// Reads the first 8 bytes of the saved file and confirms they match the
// expected signature for the declared extension.  Deletes the file and
// returns false if the signature does not match.
const SIGNATURES = {
  '.pdf':  Buffer.from([0x25, 0x50, 0x44, 0x46]),            // %PDF
  '.jpg':  Buffer.from([0xFF, 0xD8, 0xFF]),
  '.jpeg': Buffer.from([0xFF, 0xD8, 0xFF]),
  '.png':  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), // ‰PNG\r\n\x1a\n
};

const safeDeleteFile = (filePath) => {
  try {
    // Resolve to an absolute path and confirm it stays within the upload directory
    // before deleting — this prevents path-traversal attacks.
    const resolved = path.resolve(filePath);
    if (resolved.startsWith(uploadDir + path.sep) || resolved.startsWith(uploadDir)) {
      fs.unlinkSync(resolved);
    }
  } catch {
    // Ignore deletion errors — the file is either already gone or inaccessible
  }
};

const validateMagicBytes = (filePath, originalname) => {
  // Resolve to an absolute path and confirm it's inside the upload directory
  // before touching it — guards against any user-influenced path traversal.
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(uploadDir + path.sep) && resolvedPath !== uploadDir) {
    return false;
  }

  const ext = path.extname(path.basename(originalname)).toLowerCase();
  const expected = SIGNATURES[ext];
  if (!expected) return true; // .doc / .docx are ZIP/OLE — skip magic check

  try {
    const fd = fs.openSync(resolvedPath, 'r');
    const buf = Buffer.alloc(expected.length);
    fs.readSync(fd, buf, 0, expected.length, 0);
    fs.closeSync(fd);
    if (!buf.equals(expected)) {
      safeDeleteFile(resolvedPath);
      return false;
    }
    return true;
  } catch {
    safeDeleteFile(resolvedPath);
    return false;
  }
};

module.exports = upload;
module.exports.validateMagicBytes = validateMagicBytes;
module.exports.safeDeleteFile = safeDeleteFile;
