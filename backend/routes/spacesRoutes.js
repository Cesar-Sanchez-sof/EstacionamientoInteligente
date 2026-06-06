const express = require('express');
const router = express.Router();
const { getSpaces, updateSpaceStatus } = require('../controllers/spacesController');
const { protect, admin } = require('../middlewares/authMiddleware');

router.route('/').get(protect, getSpaces);
router.route('/:id').put(protect, admin, updateSpaceStatus);

module.exports = router;
