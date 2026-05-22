const { fail } = require('../utils/apiResponse');

function validate(schema) {
  return (req, res, next) => {
    const result = schema(req.body);
    if (result.valid) return next();

    return fail(res, 422, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', result.errors);
  };
}

module.exports = validate;
