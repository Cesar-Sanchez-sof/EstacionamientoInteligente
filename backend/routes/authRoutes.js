const express = require('express');
const router = express.Router();
const { 
  registerUser, 
  loginUser, 
  getUserProfile, 
  getDocumentTypes, 
  getMyVehicles, 
  addVehicle, 
  adminAddVehicle, 
  getUserVehiclesByAdmin, 
  adminUpdateUser, 
  getAllUsers 
} = require('../controllers/authController');
const { protect, admin } = require('../middlewares/authMiddleware');

router.post('/register', protect, admin, registerUser);
router.post('/login', loginUser);
router.get('/profile', protect, getUserProfile);
router.get('/document-types', getDocumentTypes);
router.get('/users', protect, admin, getAllUsers);
router.post('/admin/add-vehicle', protect, admin, adminAddVehicle);
router.get('/admin/users/:id/vehicles', protect, admin, getUserVehiclesByAdmin);
router.put('/admin/users/:id', protect, admin, adminUpdateUser);
router.route('/myvehicles')
  .get(protect, getMyVehicles)
  .post(protect, addVehicle);

module.exports = router;
