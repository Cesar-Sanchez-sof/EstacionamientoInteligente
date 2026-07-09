const express = require('express');
const router = express.Router();
const { 
  getSpaces, 
  updateSpaceStatus, 
  getPublicSpacesCount, 
  getSpacesLogs, 
  getBarrierStatus, 
  openBarrier,
  getPublicSpacesStatus
} = require('../controllers/spacesController');
const { protect, admin } = require('../middlewares/authMiddleware');

router.get('/public/count', getPublicSpacesCount);
router.get('/public/status', getPublicSpacesStatus);
router.put('/public/:id', updateSpaceStatus);
router.get('/logs', protect, admin, getSpacesLogs);
router.get('/barrier/status', getBarrierStatus);
router.post('/barrier/open', protect, admin, openBarrier);

router.route('/').get(protect, getSpaces);
router.route('/:id').put(protect, admin, updateSpaceStatus);

module.exports = router;
