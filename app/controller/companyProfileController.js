const mongoose = require('mongoose');
const CompanyProfile = require('../model/companyProfileModel');
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
  const profile = await CompanyProfile.findOne({ user: req.user.id });

  if (!profile) {
    return res.error(
      404,
      'Company profile not found. Please create your profile.',
    );
  }

  return res.success(200, 'Company profile fetched successfully', profile);
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
exports.getCompanyProfileById = catchAsync(async (req, res) => {
  const { companyId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    return res.error(400, 'Invalid company ID');
  }

  const profile = await CompanyProfile.findOne({ user: companyId }).select(
    '-__v',
  );

  if (!profile) {
    return res.error(404, 'Company not found');
  }

  // Public response থেকে email বাদ
  const data = profile.toJSON();
  delete data.email;

  return res.success(200, 'Company profile fetched successfully', data);
});
