const express = require('express');
const ctrl = require('../controller/profileController');
const { verifyToken, restrictTo } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/multerMiddleware');
const {
  getMyCompanyProfile,
  upsertMyCompanyProfile,
  getCompanyProfileById,
} = require('../controller/companyProfileController');

const router = express.Router();

const mediaUpload = upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'cover', maxCount: 1 },
  { name: 'cv', maxCount: 1 },
]);

// ---------- Public (token লাগবে না) ----------
// verifyToken-এর আগে থাকতে হবে, নাহলে public route-ও token চাইবে
router.get('/companies/:companyId', getCompanyProfileById);

// ---------- Protected: এর নিচের সব route-এ token লাগবে ----------
router.use(verifyToken);

// Specific routes আগে, dynamic /:id সবশেষে
router.get('/student', ctrl.getMyProfile);

router.get('/company/me', restrictTo('company'), getMyCompanyProfile);
router.put('/company/me', restrictTo('company'), upsertMyCompanyProfile);

router.get('/', ctrl.getProfiles);

// Media
router.patch('/media/:id', mediaUpload, ctrl.uploadMedia);

// Skills
router.put('/:id/skills', ctrl.updateSkills);

// Projects
router.post('/projects/:id', ctrl.addProject);
router.delete('/:id/projects/:projectId', ctrl.deleteProject);

// Applications
router.post('/:id/applications', ctrl.addApplication);
router
  .route('/:id/applications/:applicationId')
  .patch(restrictTo('company', 'admin'), ctrl.updateApplicationStatus)
  .delete(ctrl.withdrawApplication);

// Admin: verification + NOC
router.patch('/:id/verification', restrictTo('admin'), ctrl.verifyAndUpdateNoc);

// Dynamic routes সবশেষে
router.get('/:id', ctrl.getProfileById);
router.patch('/:id', ctrl.updateProfile);

module.exports = router;
