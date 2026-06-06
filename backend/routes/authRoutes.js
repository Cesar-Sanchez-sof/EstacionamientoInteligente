const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getUserProfile, getDocumentTypes, getMyVehicles, addVehicle } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/profile', protect, getUserProfile);
router.get('/document-types', getDocumentTypes);
router.route('/myvehicles')
  .get(protect, getMyVehicles)
  .post(protect, addVehicle);

module.exports = router;
