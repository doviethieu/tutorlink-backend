const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

router.post('/', reportController.createReport);
router.get('/me', reportController.listMyReports);

module.exports = router;
