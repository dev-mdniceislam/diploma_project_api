const mongoose = require('mongoose');
const CompanyProfile = require('../model/companyProfileModel');
const catchAsync = require('../utils/catchAsync');

// Company নিজে যা update করতে পারবে। isVerified, isBtebApproved, user বাদ।
const EDITABLE_FIELDS = [
  'companyName',
  'industryCategory',
  'about',
  'hrEmail',
  'helplineNumber',
  'website',
  'location',
  'employeeCount',
  'logoUrl',
  'coverImageUrl',
  'engineeringDomains',
  'benefits',
  'campusPartners',
];

const pickEditableFields = (body) =>
  EDITABLE_FIELDS.reduce((acc, field) => {
    if (body[field] !== undefined) acc[field] = body[field];
    return acc;
  }, {});

exports.getMyCompanyProfile = catchAsync(async (req, res) => {
  const profile = await CompanyProfile.findOne({ user: req.user.id });
  console.log(req.user.id);

  if (!profile) {
    return res.error(
      404,
      'Company profile not found. Please create your profile.',
    );
  }

  return res.success(200, 'Company profile fetched successfully', profile);
});

// @desc    Create or update logged-in company's profile
// @route   PUT /api/company-profiles/me
// @access  Private (company)
exports.upsertMyCompanyProfile = catchAsync(async (req, res) => {
  const updates = pickEditableFields(req.body);

  let profile = await CompanyProfile.findOne({ user: req.user.id });

  if (profile) {
    Object.assign(profile, updates);
    await profile.save(); // schema validation চলবে
    return res.success(200, 'Company profile updated successfully', profile);
  }

  // প্রথমবার হলে create হবে; required field না থাকলে ValidationError আসবে
  profile = await CompanyProfile.create({ ...updates, user: req.user._id });
  return res.success(201, 'Company profile created successfully', profile);
});

// @desc    Get any company's public profile by ID
// @route   GET /api/company-profiles/:companyId
// @access  Public
exports.getCompanyProfileById = catchAsync(async (req, res) => {
  const { companyId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    return res.error(400, 'Invalid company ID');
  }

  const profile = await CompanyProfile.findOne({ user: companyId }).populate(
    'user',
    'email role',
  );

  if (!profile) {
    return res.error(404, 'Company not found');
  }

  // Public response থেকে user-এর sensitive তথ্য বাদ
  const data = profile.toObject();
  if (data.user) delete data.user.email;

  return res.success(200, 'Company profile fetched successfully', data);
});
