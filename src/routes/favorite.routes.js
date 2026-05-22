const express = require('express');
const favoriteController = require('../controllers/favorite.controller');
const { protect } = require('../middlewares/auth.middleware');
const { restrictTo } = require('../middlewares/role.middleware');

const router = express.Router();

router.use(protect);

router.get('/favorites', restrictTo('student', 'admin'), favoriteController.listFavorites);
router.post('/favorites/:tutorId', restrictTo('student', 'admin'), favoriteController.addFavorite);
router.delete('/favorites/:tutorId', restrictTo('student', 'admin'), favoriteController.removeFavorite);

module.exports = router;
