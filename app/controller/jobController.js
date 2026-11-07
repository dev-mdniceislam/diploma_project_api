const Job = require('../model/jobPostModel');
const catchAsync = require('../utils/catchAsync');
const CompanyProfile = require('../model/companyProfileModel');
const mongoose = require('mongoose');

const ALLOWED_FIELDS = [
  'title',
  'jobType',
  'description',
  'responsibilities',
  'requirements',
  'departments',
  'location',
  'stipend',
  'semester',
  'educationRequirement',
  'vacancies',
  'accommodation',
  'deadline',
  'contactEmail',
  'contactPhone',
  'website',
];

const pickAllowedFields = (body) =>
  ALLOWED_FIELDS.reduce((acc, field) => {
    if (body[field] !== undefined) acc[field] = body[field];
    return acc;
  }, {});

exports.createJob = catchAsync(async (req, res) => {
  const jobData = pickAllowedFields(req.body);

  const job = await Job.create({
    ...jobData,
    postedBy: req.user.id,
  });

  return res.success(201, 'Job posted successfully', job);
});

exports.getJobById = catchAsync(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.error(400, 'Invalid job ID');
  }

  const job = await Job.findById(id).select('-__v').lean();

  if (!job) {
    return res.error(404, 'Job not found');
  }

  const company = await CompanyProfile.findOne({ user: job.postedBy })
    .select('companyName industryCategory profileUrl isVerified isBtebApproved')
    .lean();

  const isApplicationOpen = job.status === 'open' && job.deadline > new Date();

  return res.success(200, 'Job fetched successfully', {
    ...job,
    postedBy: company ? { id: company._id, ...company, _id: undefined } : null,
    isApplicationOpen,
  });
});
