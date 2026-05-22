function ok(res, data = null, meta = undefined, statusCode = 200) {
  const body = {
    success: true,
    data,
    error: null,
  };

  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

function fail(res, statusCode, code, message, details = undefined) {
  const body = {
    success: false,
    data: null,
    error: {
      code,
      message,
    },
  };

  if (details) body.error.details = details;
  return res.status(statusCode).json(body);
}

module.exports = { ok, fail };
