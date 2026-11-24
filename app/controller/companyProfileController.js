const mongoose = require('mongoose');
const CompanyProfile = require('../model/companyProfileModel');
const StudentProfile = require('../model/profileModel');
const User = require('../model/userModel');
const Job = require('../model/jobPostModel');
const Application = require('../model/applicationModel');
const catchAsync = require('../utils/catchAsync');
const deleteFileFromCloudinary = require('../middleware/fileDeleteMiddleware');
const getPublicIdFromUrl = require('../middleware/getPublicIdFromURL');

// Company নিজে যা update করতে পারবে।
// isVerified, isBtebApproved, user, email (auth থেকে আসবে), profileUrl ও coverImageUrl (upload থেকে আসবে) বাদ।
const EDITABLE_FIELDS = [
  'companyName',
  'industryCategory',
  'about',
  'hrEmail',
  'helplineNumber',
  'website',
  'location',
  'employeeCount',
  'engineeringDomains',
  'benefits',
  'campusPartners',
];

const PROFILE_MODELS = {
  student: StudentProfile,
  company: CompanyProfile,
};

// multer field name -> schema field
const MEDIA_FIELDS = {
  profileImage: 'profileUrl',
  coverImage: 'coverImageUrl',
};

const pickEditableFields = (body) =>
  EDITABLE_FIELDS.reduce((acc, field) => {
    if (body[field] !== undefined) acc[field] = body[field];
    return acc;
  }, {});

// campusPartners থেকে isMouVerified বাদ, এটা admin-only
const sanitizeCampusPartners = (partners) => {
  if (!Array.isArray(partners)) return partners;

  return partners.map((p) => ({
    instituteName: p.instituteName,
    annualInternQuota: p.annualInternQuota,
  }));
};

// @desc    Logged-in company's profile
// @route   GET /api/company-profiles/me
// @access  Private (company)
exports.getMyCompanyProfile = catchAsync(async (req, res) => {
  const companyObjectId = new mongoose.Types.ObjectId(req.user.id);

  const profile = await CompanyProfile.findOne({ user: companyObjectId });

  if (!profile) {
    return res.error(
      404,
      'Company profile not found. Please create your profile.',
    );
  }

  // Job count, shob job memory-te load na kore
  const [jobCounts] = await Job.aggregate([
    { $match: { postedBy: companyObjectId } },
    {
      $group: {
        _id: null,
        totalCirculars: { $sum: 1 },
        industrialAttachments: {
          $sum: {
            $cond: [{ $eq: ['$jobType', 'industrial-attachment'] }, 1, 0],
          },
        },
      },
    },
  ]);

  const totalCirculars = jobCounts?.totalCirculars ?? 0;
  const industrialAttachments = jobCounts?.industrialAttachments ?? 0;

  // Application-e company field already ache, tai job id lagbe na
  const applicationsReceived = await Application.countDocuments({
    company: companyObjectId,
  });

  const data = {
    ...profile.toJSON(),
    stats: {
      totalCirculars,
      jobCirculars: totalCirculars - industrialAttachments,
      industrialAttachments,
      applicationsReceived,
    },
  };

  return res.success(200, 'Company profile fetched successfully', data);
});

// @desc    Create or update logged-in company's profile (text fields only)
// @route   PUT /api/company-profiles/me
// @access  Private (company)
exports.upsertMyCompanyProfile = catchAsync(async (req, res) => {
  const updates = pickEditableFields(req.body);

  if (updates.campusPartners !== undefined) {
    updates.campusPartners = sanitizeCampusPartners(updates.campusPartners);
  }

  let profile = await CompanyProfile.findOne({ user: req.user.id });

  if (profile) {
    Object.assign(profile, updates);
    await profile.save();
    return res.success(200, 'Company profile updated successfully', profile);
  }

  // প্রথমবার হলে create হবে। email schema তে required, তাই auth user থেকে নেওয়া হচ্ছে
  profile = await CompanyProfile.create({
    ...updates,
    user: req.user.id,
    email: req.user.email,
  });

  return res.success(201, 'Company profile created successfully', profile);
});

// @desc    Upload profile image and/or cover image
// @route   PUT /api/company-profiles/me/media
// @access  Private (company)
exports.uploadMedia = catchAsync(async (req, res) => {
  const files = req.files || {};
  const uploadedFields = Object.keys(MEDIA_FIELDS).filter((f) => files[f]?.[0]);

  if (uploadedFields.length === 0) {
    return res.error(400, 'No file uploaded');
  }

  const profile = await CompanyProfile.findOne({ user: req.user.id });
  if (!profile) {
    return res.error(
      404,
      'Company profile not found. Please create your profile first.',
    );
  }

  const oldIds = [];

  uploadedFields.forEach((field) => {
    const key = MEDIA_FIELDS[field];
    if (profile[key]) oldIds.push(getPublicIdFromUrl(profile[key]));
    profile[key] = files[field][0].path; // Cloudinary secure URL
  });

  await profile.save();

  // Save সফল হওয়ার পরে পুরনো file delete হবে
  await deleteFileFromCloudinary(oldIds.filter(Boolean));

  return res.success(200, 'Media uploaded successfully', {
    profileUrl: profile.profileUrl,
    coverImageUrl: profile.coverImageUrl,
  });
});

// @desc    Get any company's public profile by ID
// @route   GET /api/company-profiles/:companyId
// @access  Public

const STUDENT_PUBLIC_FIELDS = [
  'name',
  'avatarUrl',
  'coverImage',
  'bio',
  'department',
  'institute',
  'session',
  'semester',
  'location',
  'isVerified',
  'skills',
  'projects',
  'socialLinks',
  'ssc',
];

const COMPANY_PUBLIC_FIELDS = [
  'companyName',
  'profileUrl',
  'coverImageUrl',
  'about',
  'industryCategory',
  'employeeCount',
  'location',
  'website',
  'benefits',
  'engineeringDomains',
  'campusPartners',
  'isVerified',
  'isBtebApproved',
];

// Object theke shudhu allowed key gulo rakhe
const pick = (obj, keys) =>
  keys.reduce((acc, key) => {
    if (obj[key] !== undefined) acc[key] = obj[key];
    return acc;
  }, {});

exports.getPublicProfileById = catchAsync(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.error(400, 'Invalid user ID');
  }

  const user = await User.findById(id).select('role').lean();
  if (!user) {
    return res.error(404, 'User not found');
  }

  const Model = PROFILE_MODELS[user.role];
  if (!Model) {
    return res.error(404, 'Public profile not available for this user');
  }

  const profile = await Model.findOne({ user: id }).select('-__v').lean();
  if (!profile) {
    return res.error(404, 'Profile not found');
  }

  let data;

  if (user.role === 'student') {
    data = pick(profile, STUDENT_PUBLIC_FIELDS);
  } else {
    data = pick(profile, COMPANY_PUBLIC_FIELDS);
  }

  return res.success(200, 'Public profile fetched successfully', {
    role: user.role,
    ...data,
  });
});
