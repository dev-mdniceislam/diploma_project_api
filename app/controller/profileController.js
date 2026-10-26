const StudentProfile = require('../model/profileModel');
const deleteFileFromCloudinary = require('../middleware/fileDeleteMiddleware');
const getPublicIdFromUrl = require('../middleware/getPublicIdFromURL');

// Errors go to your errorHandler (ValidationError, CastError, 11000 ...)
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Fields a student may NOT set themselves
const PROTECTED_FIELDS = [
  'user',
  'email', // User.email-এর সাথে মিল রাখতে
  'isVerified',
  'nocStatus',
  'nocNumber',
  'cgpa',
  'avatarUrl',
  'coverImage',
  'cvUrl',
];

const stripProtected = (body) => {
  const data = { ...body };
  PROTECTED_FIELDS.forEach((f) => delete data[f]);
  return data;
};

// Loads the profile and makes sure the caller is its owner (or an admin).
// Returns null after sending the error response.
const loadOwnedProfile = async (req, res) => {
  const { id } = req.params;
  if (id !== String(req.user.id) && req.user.role !== 'admin') {
    res.error(403, 'You are not allowed to modify this profile');
    return null;
  }
  const profile = await StudentProfile.findOne({ user: id });
  if (!profile) {
    res.error(404, 'Student profile not found');
    return null;
  }
  return profile;
};

// ---------- Profile CRUD ----------

exports.getMyProfile = asyncHandler(async (req, res) => {
  const profile = await StudentProfile.findOne({ user: req.user.id });
  if (!profile) return res.error(404, 'You have not created a profile yet');
  res.success(200, 'Profile fetched successfully', profile);
});

exports.getProfiles = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    department,
    semester,
    search,
    verified,
  } = req.query;

  const filter = {};
  if (department) filter.department = department;
  if (semester) filter.semester = Number(semester);
  if (verified !== undefined) filter.isVerified = verified === 'true';
  if (search) filter.$text = { $search: search };

  const skip = (Number(page) - 1) * Number(limit);

  const [items, total] = await Promise.all([
    StudentProfile.find(filter)
      .select('-applications -semesterResults')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    StudentProfile.countDocuments(filter),
  ]);

  res.success(200, 'Profiles fetched successfully', {
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
    items,
  });
});

exports.getProfileById = asyncHandler(async (req, res) => {
  const profile = await StudentProfile.findOne({ user: req.params.id });
  if (!profile) return res.error(404, 'Student profile not found');
  res.success(200, 'Profile fetched successfully', profile);
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const profile = await loadOwnedProfile(req, res);
  if (!profile) return;

  Object.assign(profile, stripProtected(req.body));
  await profile.save();
  res.success(200, 'Profile updated successfully', profile);
});

exports.deleteProfile = asyncHandler(async (req, res) => {
  const profile = await loadOwnedProfile(req, res);
  if (!profile) return;

  const publicIds = [profile.avatarUrl, profile.coverImage, profile.cvUrl]
    .filter(Boolean)
    .map(getPublicIdFromUrl)
    .filter(Boolean);

  await profile.deleteOne();
  await deleteFileFromCloudinary(publicIds);

  res.success(200, 'Profile deleted successfully');
});

// ---------- Media upload (avatar / cover / cv) ----------
// multer-storage-cloudinary puts the uploaded file URL in file.path

exports.uploadMedia = asyncHandler(async (req, res) => {
  const profile = await loadOwnedProfile(req, res);
  if (!profile) return;

  const files = req.files || {};
  const fieldMap = { avatar: 'avatarUrl', cover: 'coverImage', cv: 'cvUrl' };
  const oldIds = [];

  Object.entries(fieldMap).forEach(([field, key]) => {
    const file = files[field]?.[0];
    if (!file) return;
    if (profile[key]) oldIds.push(getPublicIdFromUrl(profile[key]));
    profile[key] = file.path;
  });

  if (!Object.keys(fieldMap).some((f) => files[f]?.[0])) {
    return res.error(400, 'No file uploaded');
  }

  await profile.save();
  await deleteFileFromCloudinary(oldIds.filter(Boolean)); // remove replaced files

  res.success(200, 'Media uploaded successfully', {
    avatarUrl: profile.avatarUrl,
    coverImage: profile.coverImage,
    cvUrl: profile.cvUrl,
  });
});

// ---------- Admin: verification & NOC ----------

exports.verifyAndUpdateNoc = asyncHandler(async (req, res) => {
  const { isVerified, nocStatus, nocNumber } = req.body;
  const update = {};
  if (isVerified !== undefined) update.isVerified = isVerified;
  if (nocStatus) update.nocStatus = nocStatus;
  if (nocNumber !== undefined) update.nocNumber = nocNumber;

  const profile = await StudentProfile.findOneAndUpdate(
    { user: req.params.id },
    update,
    { returnDocument: 'after', runValidators: true },
  );
  if (!profile) return res.error(404, 'Student profile not found');
  res.success(200, 'Verification updated successfully', profile);
});

// ---------- Skills ----------

exports.updateSkills = asyncHandler(async (req, res) => {
  const profile = await loadOwnedProfile(req, res);
  if (!profile) return;

  profile.skills = req.body.skills;
  await profile.save();
  res.success(200, 'Skills updated successfully', profile.skills);
});

// ---------- Projects ----------

exports.addProject = asyncHandler(async (req, res) => {
  const profile = await loadOwnedProfile(req, res);
  if (!profile) return;

  profile.projects.push(req.body);
  await profile.save();
  res.success(201, 'Project added successfully', profile.projects);
});

exports.updateProject = asyncHandler(async (req, res) => {
  const profile = await loadOwnedProfile(req, res);
  if (!profile) return;

  const project = profile.projects.id(req.params.projectId);
  if (!project) return res.error(404, 'Project not found');

  project.set(req.body);
  await profile.save();
  res.success(200, 'Project updated successfully', project);
});

exports.deleteProject = asyncHandler(async (req, res) => {
  const profile = await loadOwnedProfile(req, res);
  if (!profile) return;

  const project = profile.projects.id(req.params.projectId);
  if (!project) return res.error(404, 'Project not found');

  project.deleteOne();
  await profile.save();
  res.success(200, 'Project removed successfully');
});

// ---------- Applications ----------

exports.addApplication = asyncHandler(async (req, res) => {
  const profile = await loadOwnedProfile(req, res);
  if (!profile) return;

  const { status, message, ...rest } = req.body; // status/message are company-controlled
  profile.applications.push(rest);
  await profile.save();
  res.success(201, 'Application submitted successfully', profile.applications);
});

// company / admin only (see router)
exports.updateApplicationStatus = asyncHandler(async (req, res) => {
  const profile = await StudentProfile.findOne({ user: req.params.id });
  if (!profile) return res.error(404, 'Student profile not found');

  const application = profile.applications.id(req.params.applicationId);
  if (!application) return res.error(404, 'Application not found');

  if (req.body.status) application.status = req.body.status;
  if (req.body.message !== undefined) application.message = req.body.message;

  await profile.save();
  res.success(200, 'Application updated successfully', application);
});

exports.withdrawApplication = asyncHandler(async (req, res) => {
  const profile = await loadOwnedProfile(req, res);
  if (!profile) return;

  const application = profile.applications.id(req.params.applicationId);
  if (!application) return res.error(404, 'Application not found');

  application.deleteOne();
  await profile.save();
  res.success(200, 'Application withdrawn successfully');
});
