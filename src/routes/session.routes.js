const express = require('express');
const sessionController = require('../controllers/session.controller');
const { protect } = require('../middlewares/auth.middleware');
const { restrictTo } = require('../middlewares/role.middleware');

const router = express.Router();

router.use(protect);

router.get('/', sessionController.listSessions);
router.get('/:id', sessionController.getSessionById);
router.patch('/:id/complete', restrictTo('tutor', 'admin'), sessionController.markCompleted);

module.exports = router;
