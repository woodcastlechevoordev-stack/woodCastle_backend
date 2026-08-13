function notFound(req, res, next) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-console
  console.error(err);

  if (err.code === 'P2002') {
    const fields = err.meta?.target || [];
    return res.status(409).json({
      error: 'Unique constraint failed',
      fields,
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found' });
  }

  if (err.code === 'P2022') {
    return res.status(500).json({
      error: 'Database schema mismatch — Prisma client needs to be regenerated',
      code: err.code,
    });
  }

  if (err.code === 'P2003') {
    return res.status(400).json({ error: 'Invalid related record' });
  }

  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }

  const status = err.statusCode || 500;
  return res.status(status).json({
    error: status === 500 ? 'Internal server error' : err.message,
    ...(status === 500 && err.code ? { code: err.code } : {}),
  });
}

function createError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

module.exports = { notFound, errorHandler, createError };
