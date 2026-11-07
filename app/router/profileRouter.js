const express = require('express');
const ctrl = require('../controller/profileController');
const { verifyToken, restrictTo } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/multerMiddleware');
const companyCtrl = require('../controller/companyProfileController');

const router = express.Router();

// Student media: avatar, cover, cv
const studentMediaUpload = upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'cover', maxCount: 1 },
  { name: 'cv', maxCount: 1 },
]);

// Company media: profileImage, coverImage
const companyMediaUpload = upload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 },
]);

// ---------- Public ----------
router.get('/companies/:companyId', companyCtrl.getCompanyProfileById);

// ---------- Protected: এর নিচের সব route-এ token লাগবে ----------
router.use(verifyToken);

// Specific routes আগে, dynamic /:id সবশেষে

// Company own profile
router.get(
  '/company/me',
  restrictTo('company'),
  companyCtrl.getMyCompanyProfile,
);
router.put(
  '/company/me',
  restrictTo('company'),
  companyCtrl.upsertMyCompanyProfile,
);
router.patch(
  '/company/me/media',
  restrictTo('company'),
  companyMediaUpload,
  companyCtrl.uploadMedia,
);

// Student own profile
router.get('/student', ctrl.getMyProfile);

router.get('/', ctrl.getProfiles);

// Student media (id সহ)
router.patch('/media/:id', studentMediaUpload, ctrl.uploadMedia);

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
