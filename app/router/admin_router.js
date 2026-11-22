const express = require('express');
const {
  listVerificationRequests,
  getVerificationDetail,
  reviewVerification,
} = require('../controller/verificationRequestController');
const { verifyToken, restrictTo } = require('../middleware/authMiddleware');

const router = express.Router();

// এই router-এর সব route admin-only
router.use(verifyToken, restrictTo('admin'));

router.get('/', listVerificationRequests);
router.get('/:id', getVerificationDetail);
router.patch('/:id/review', reviewVerification);

module.exports = router;
