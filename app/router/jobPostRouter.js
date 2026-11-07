const express = require('express');
const { createJob, getJobById } = require('../controller/jobController');
const { verifyToken, restrictTo } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', verifyToken, restrictTo('company'), createJob);
router.get('/:id', getJobById);

module.exports = router;
