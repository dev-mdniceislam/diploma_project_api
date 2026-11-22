const express = require('express');
const {
  submitVerification,
  getMyVerification,
} = require('../controller/verificationRequestController');
const { restrictTo, verifyToken } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/multerMiddleware');

const router = express.Router();
router.use(verifyToken, restrictTo('company'));

// Company routes
router.post(
  '/',
  upload.fields([
    { name: 'tradeLicense', maxCount: 1 },
    { name: 'tin', maxCount: 1 },
    { name: 'bin', maxCount: 1 },
    { name: 'addressProof', maxCount: 1 },
  ]),
  submitVerification,
);

router.get('/me', getMyVerification);

module.exports = router;
