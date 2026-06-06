const express = require('express');
const router = express.Router();
const {
  createReservation,
  getMyReservations,
  getReservations,
  deleteReservation
} = require('../controllers/reservationsController');
const { protect, admin } = require('../middlewares/authMiddleware');

router.route('/')
  .post(protect, createReservation)
  .get(protect, admin, getReservations);

router.route('/myreservations').get(protect, getMyReservations);

router.route('/:id').delete(protect, deleteReservation);

module.exports = router;
