const express = require('express');
const router = express.Router();
const { getSpaces, updateSpaceStatus, getPublicSpacesCount } = require('../controllers/spacesController');
const { protect, admin } = require('../middlewares/authMiddleware');

router.get('/public/count', getPublicSpacesCount);
router.route('/').get(protect, getSpaces);
router.route('/:id').put(protect, admin, updateSpaceStatus);

module.exports = router;
