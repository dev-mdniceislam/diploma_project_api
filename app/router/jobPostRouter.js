const express = require('express');
const { createJob } = require('../controller/jobController');
const { verifyToken } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', verifyToken, createJob);

module.exports = router;
