const { fail } = require('../utils/apiResponse');

function notFound(req, res) {
  return fail(res, 404, 'NOT_FOUND', 'Route không tồn tại');
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const statusCode = error.statusCode || 500;
  const code = error.code || (statusCode === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');
  const message = statusCode === 500 ? 'Lỗi hệ thống nội bộ' : error.message;

  if (statusCode === 500) {
    console.error('[error]', error);
  }

  return fail(res, statusCode, code, message, error.details);
}

module.exports = { notFound, errorHandler };
