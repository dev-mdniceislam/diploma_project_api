const express = require('express');
const {
  createJob,
  getJobById,
  getAllJobs,
  myPostedJobs,
  deleteJob,
} = require('../controller/jobController');
const { verifyToken, restrictTo } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/my-jobs', verifyToken, restrictTo('company'), myPostedJobs);

router.delete('/delete/:id', verifyToken, restrictTo('company'), deleteJob);

router.post('/', verifyToken, restrictTo('company'), createJob);
router.get('/', verifyToken, getAllJobs);
router.get('/:id', getJobById);

module.exports = router;
