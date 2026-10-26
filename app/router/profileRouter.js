const express = require('express');
const ctrl = require('../controller/profileController');
const { verifyToken } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/multerMiddleware');

const router = express.Router();

// Role guard built on the role stored in the JWT by generateToken(id, role)
const restrictTo =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user?.role)
      ? next()
      : res.error(403, 'You do not have permission to perform this action');

const mediaUpload = upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'cover', maxCount: 1 },
  { name: 'cv', maxCount: 1 },
]);

router.use(verifyToken); // every route needs a valid token

// Profile
router.get('/me', ctrl.getMyProfile); // keep above '/:id'
router.route('/').get(ctrl.getProfiles);

router
  .route('/:id')
  .get(ctrl.getProfileById)
  .patch(ctrl.updateProfile)
  .delete(ctrl.deleteProfile);

// Media (multipart/form-data: avatar, cover, cv)
router.patch('/media/:id', mediaUpload, ctrl.uploadMedia);

// Admin: verification + NOC
router.patch('/:id/verification', restrictTo('admin'), ctrl.verifyAndUpdateNoc);

// Skills
router.put('/:id/skills', ctrl.updateSkills);

// Projects
router.post('/projects/:id', ctrl.addProject);
router
  .route('/:id/projects/:projectId')
  .patch(ctrl.updateProject)
  .delete(ctrl.deleteProject);

// Applications
router.post('/:id/applications', ctrl.addApplication);
router
  .route('/:id/applications/:applicationId')
  .patch(restrictTo('company', 'admin'), ctrl.updateApplicationStatus)
  .delete(ctrl.withdrawApplication);

module.exports = router;

// app.js
// app.use(responseHandler);                       // before routes
// app.use('/api/v1/students', require('./routes/studentProfile.routes'));
// app.use(errorHandler);                          // after routes
