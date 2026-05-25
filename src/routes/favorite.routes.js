const express = require('express');
const favoriteController = require('../controllers/favorite.controller');
const { protect } = require('../middlewares/auth.middleware');
const { restrictTo } = require('../middlewares/role.middleware');

const router = express.Router();

router.use(protect);

router.get('/', restrictTo('student', 'tutor', 'admin'), favoriteController.listFavorites);
router.post('/:tutorId', restrictTo('student', 'tutor', 'admin'), favoriteController.addFavorite);
router.delete('/:tutorId', restrictTo('student', 'tutor', 'admin'), favoriteController.removeFavorite);

module.exports = router;
