const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

router.post('/support', reportController.createReport);
router.get('/support/me', reportController.listMyReports);

router.post('/reports', reportController.createReport);
router.get('/reports/me', reportController.listMyReports);

module.exports = router;
