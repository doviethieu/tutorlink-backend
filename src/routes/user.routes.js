const express = require('express');
const userController = require('../controllers/user.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);

router.route('/me')
  .get(userController.getMe)
  .patch(userController.updateMe)
  .delete(userController.deleteMe);

router.patch('/me/password', userController.changePassword);
router.get('/me/wallet', userController.getWallet);
router.post('/me/wallet/deposit', userController.depositWallet);

module.exports = router;
