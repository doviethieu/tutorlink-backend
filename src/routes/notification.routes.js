const express = require('express');
const notificationController = require('../controllers/notification.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);

router.get('/notifications', notificationController.listNotifications);
router.patch('/notifications/read-all', notificationController.markAllRead);
router.patch('/notifications/:id/read', notificationController.markRead);

module.exports = router;
