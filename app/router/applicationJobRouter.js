const express = require('express');
const {
  myApplications,
  applyToJob,
  jobApplicants,
  companyApplications,
  withdrawApplication,
} = require('../controller/applicationController');
const { verifyToken, restrictTo } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/multerMiddleware');

const router = express.Router();

// সব route এ token লাগবে
router.use(verifyToken);

router.get('/company', verifyToken, restrictTo('company'), companyApplications);

// Student: নিজের applications
router.get('/me', restrictTo('student'), myApplications);

// Company: একটা job এর applicants (job owner only)
router.get('/job/:jobId', restrictTo('company'), jobApplicants);

// Student: একটা job এ apply
router.post('/:jobId', restrictTo('student'), upload.single('cv'), applyToJob);

router.delete('/:id', verifyToken, restrictTo('student'), withdrawApplication);

module.exports = router;
