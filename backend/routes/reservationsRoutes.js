const express = require('express');
const router = express.Router();
const {
  createReservation,
  getMyReservations,
  getReservations,
  deleteReservation,
  updateReservationStatus
} = require('../controllers/reservationsController');
const { protect, admin } = require('../middlewares/authMiddleware');

router.route('/')
  .post(protect, createReservation)
  .get(protect, admin, getReservations);

router.route('/myreservations').get(protect, getMyReservations);

router.route('/:id')
  .delete(protect, deleteReservation);

router.route('/:id/status')
  .put(protect, updateReservationStatus);

module.exports = router;
