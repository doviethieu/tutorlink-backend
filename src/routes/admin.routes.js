const express = require('express');
const adminController = require('../controllers/admin.controller');
const reviewController = require('../controllers/review.controller');
const { protect } = require('../middlewares/auth.middleware');
const { restrictTo } = require('../middlewares/role.middleware');

const router = express.Router();

router.use(protect, restrictTo('admin'));

router.get('/stats/overview', adminController.overview);
router.get('/overview', adminController.overview);

router.get('/tutors/queue', adminController.tutorQueue);
router.get('/tutors', adminController.tutorQueue);
router.get('/tutors/:id', adminController.getTutor);
router.patch('/tutors/:id/approve', adminController.approveTutor);
router.post('/tutors/:id/approve', adminController.approveTutor);
router.patch('/tutors/:id/reject', adminController.rejectTutor);
router.post('/tutors/:id/reject', adminController.rejectTutor);
router.patch('/tutors/:id/request-info', adminController.requestTutorInfo);
router.post('/tutors/:id/request-info', adminController.requestTutorInfo);
router.patch('/tutors/:id/suspend', adminController.suspendTutor);
router.post('/tutors/:id/suspend', adminController.suspendTutor);

router.get('/users', adminController.users);
router.patch('/users/:id/lock', adminController.lockUser);
router.post('/users/:id/lock', adminController.lockUser);
router.patch('/users/:id/unlock', adminController.unlockUser);
router.post('/users/:id/unlock', adminController.unlockUser);

router.get('/reports/export.csv', adminController.exportReportsCsv);
router.get('/reports/export-csv', adminController.exportReportsCsv);
router.get('/reports', adminController.reports);
router.patch('/reports/:id/resolve', adminController.resolveReport);
router.post('/reports/:id/resolve', adminController.resolveReport);

router.patch('/reviews/:id/hide', reviewController.hideReview);

router.get('/payments', adminController.payments);

router.get('/payouts', adminController.payouts);
router.patch('/payouts/:id', adminController.updatePayout);
router.post('/payouts/:id', adminController.updatePayout);

router.get('/system-configs', adminController.systemConfigs);
router.patch('/system-configs/:key', adminController.updateSystemConfig);
router.post('/system-configs/:key', adminController.updateSystemConfig);

router.get('/audit-logs', adminController.auditLogs);

module.exports = router;
