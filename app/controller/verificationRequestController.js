const VerificationRequest = require('../model/verificationRequestModel');
const CompanyProfile = require('../model/companyProfileModel');
const catchAsync = require('../utils/catchAsync');
const mongoose = require('mongoose');
const deleteFileFromCloudinary = require('../middleware/fileDeleteMiddleware');
const getPublicIdFromUrl = require('../middleware/getPublicIdFromURL');

// multer-storage-cloudinary file.path-এ uploaded URL থাকে
const FILE_FIELD_MAP = {
  tradeLicense: 'trade_license',
  tin: 'tin',
  bin: 'bin',
  btebLetter: 'bteb_letter',
  addressProof: 'address_proof',
};

const REQUIRED_DOC_TYPES = ['trade_license', 'tin'];
const REVIEW_DECISIONS = ['approved', 'rejected'];
const STATUS_VALUES = ['pending', 'approved', 'rejected'];

// request fail হলে Cloudinary থেকে এই request-এর সব uploaded file মুছে ফেলা
const removeUploadedFiles = async (req) => {
  const files = Object.values(req.files || {}).flat();
  const publicIds = files
    .map((file) => getPublicIdFromUrl(file.path))
    .filter(Boolean);

  if (publicIds.length > 0) {
    await deleteFileFromCloudinary(publicIds);
  }
};

// @desc    Company verification application জমা দেওয়া
// @route   POST /api/verification
// @access  Private (company)
exports.submitVerification = catchAsync(async (req, res) => {
  const companyId = req.user.id;

  // Validation fail করলে file মুছে response পাঠানো
  const fail = async (statusCode, message) => {
    await removeUploadedFiles(req);
    return res.error(statusCode, message);
  };

  try {
    const profile = await CompanyProfile.findOne({ user: companyId })
      .select('isVerified')
      .lean();

    if (!profile) {
      return fail(
        404,
        'Company profile not found. Please complete your profile first.',
      );
    }

    if (profile.isVerified) {
      return fail(400, 'Your company is already verified');
    }

    const existingPending = await VerificationRequest.findOne({
      company: companyId,
      status: 'pending',
    }).lean();

    if (existingPending) {
      return fail(400, 'You already have a pending verification request');
    }

    const files = req.files || {};
    const documents = Object.entries(FILE_FIELD_MAP)
      .filter(([field]) => files[field]?.[0])
      .map(([field, type]) => ({
        type,
        url: files[field][0].path,
      }));

    if (documents.length === 0) {
      return fail(400, 'No verification document uploaded');
    }

    const uploadedTypes = documents.map((doc) => doc.type);
    const missing = REQUIRED_DOC_TYPES.filter(
      (type) => !uploadedTypes.includes(type),
    );

    if (missing.length > 0) {
      return fail(400, `Missing required documents: ${missing.join(', ')}`);
    }

    const request = await VerificationRequest.create({
      company: companyId,
      documents,
    });

    return res.success(
      201,
      'Verification request submitted successfully',
      request,
    );
  } catch (err) {
    // DB error বা Mongoose validation error হলে file রাখা যাবে না
    await removeUploadedFiles(req);
    throw err;
  }
});

// @desc    নিজের সর্বশেষ verification request দেখা
// @route   GET /api/verification/me
// @access  Private (company)
exports.getMyVerification = catchAsync(async (req, res) => {
  const request = await VerificationRequest.findOne({ company: req.user.id })
    .sort({ createdAt: -1 })
    .lean();

  if (!request) {
    return res.error(404, 'No verification request found');
  }

  return res.success(200, 'Verification request fetched successfully', request);
});

// @desc    সব verification request list (status filter সহ)
// @route   GET /api/admin/verifications?status=pending&page=1&limit=10
// @access  Private (admin)
exports.listVerificationRequests = catchAsync(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
  const skip = (page - 1) * limit;

  const filter = {};
  if (STATUS_VALUES.includes(req.query.status)) {
    filter.status = req.query.status;
  }

  const [requests, total] = await Promise.all([
    VerificationRequest.find(filter)
      .populate('company', 'email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    VerificationRequest.countDocuments(filter),
  ]);

  return res.success(200, 'Verification requests fetched successfully', {
    requests,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// @desc    একটা verification request-এর detail (company profile সহ)
// @route   GET /api/admin/verifications/:id
// @access  Private (admin)
exports.getVerificationDetail = catchAsync(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.error(400, 'Invalid request ID');
  }

  const request = await VerificationRequest.findById(id)
    .populate('company', 'email createdAt')
    .lean();

  if (!request) {
    return res.error(404, 'Verification request not found');
  }

  // company user delete হয়ে থাকলে populate null দেয়
  const companyUser = request.company;
  const profile = companyUser
    ? await CompanyProfile.findOne({ user: companyUser._id })
        .select('-__v')
        .lean()
    : null;

  return res.success(200, 'Verification detail fetched successfully', {
    ...request,
    companyProfile: profile,
    companyDeleted: !companyUser,
  });
});

// @desc    Approve বা reject করা
// @route   PATCH /api/admin/verifications/:id/review
// @access  Private (admin)
exports.reviewVerification = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { decision } = req.body;
  const rejectionReason =
    typeof req.body.rejectionReason === 'string'
      ? req.body.rejectionReason.trim()
      : '';

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.error(400, 'Invalid request ID');
  }

  if (!REVIEW_DECISIONS.includes(decision)) {
    return res.error(400, 'decision must be "approved" or "rejected"');
  }

  if (decision === 'rejected' && !rejectionReason) {
    return res.error(400, 'rejectionReason is required when rejecting');
  }

  const request = await VerificationRequest.findById(id);
  if (!request) {
    return res.error(404, 'Verification request not found');
  }

  if (request.status !== 'pending') {
    return res.error(400, `This request is already ${request.status}`);
  }

  // আগে company profile update, তারপর request status.
  // এভাবে profile update fail করলে request pending থাকে।
  if (decision === 'approved') {
    const profile = await CompanyProfile.findOneAndUpdate(
      { user: request.company },
      { isVerified: true },
    );

    if (!profile) {
      return res.error(404, 'Company profile not found');
    }
  }

  request.status = decision;
  request.reviewedBy = req.user.id;
  request.reviewedAt = new Date();
  request.rejectionReason = decision === 'rejected' ? rejectionReason : null;
  await request.save();

  return res.success(200, `Verification ${decision} successfully`, request);
});
