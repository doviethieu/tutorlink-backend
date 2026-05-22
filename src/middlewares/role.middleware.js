const { fail } = require('../utils/apiResponse');

function restrictTo(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return fail(res, 403, 'FORBIDDEN', 'Bạn không có quyền thực hiện hành động này');
    }

    return next();
  };
}

module.exports = { restrictTo };
