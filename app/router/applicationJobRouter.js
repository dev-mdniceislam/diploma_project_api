const express = require('express');
const {
  myApplications,
  applyToJob,
  jobApplicants,
} = require('../controller/applicationController');
const { verifyToken, restrictTo } = require('../middleware/authMiddleware');

const router = express.Router();

// সব route এ token লাগবে
router.use(verifyToken);

// Student: নিজের applications
router.get('/me', restrictTo('student'), myApplications);

// Company: একটা job এর applicants (job owner only)
router.get('/job/:jobId', restrictTo('company'), jobApplicants);

// Student: একটা job এ apply
router.post('/:jobId', restrictTo('student'), applyToJob);

module.exports = router;
