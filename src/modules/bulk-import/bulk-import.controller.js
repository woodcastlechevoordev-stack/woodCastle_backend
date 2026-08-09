const multer = require('multer');
const service = require('./bulk-import.service');
const { asyncHandler } = require('../../utils/helpers');
const { createError } = require('../../middleware/errorHandler');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter(req, file, cb) {
    const ok =
      /\.xlsx$/i.test(file.originalname) ||
      file.mimetype ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (!ok) {
      return cb(createError(400, 'Only .xlsx files are allowed'));
    }
    return cb(null, true);
  },
});

const previewUpload = upload.single('file');

const preview = [
  (req, res, next) => {
    previewUpload(req, res, (err) => {
      if (err) return next(err);
      return next();
    });
  },
  asyncHandler(async (req, res) => {
    const result = await service.preview(req.file, req.admin.id);
    res.json(result);
  }),
];

const confirm = asyncHandler(async (req, res) => {
  const result = await service.confirm(req.body.importId, req.admin.id);
  res.json(result);
});

const history = asyncHandler(async (req, res) => {
  const logs = await service.history();
  res.json(logs);
});

module.exports = { preview, confirm, history };
