const Job = require('../model/jobPostModel');
const catchAsync = require('../utils/catchAsync');
const CompanyProfile = require('../model/companyProfileModel');
const Application = require('../model/applicationModel');
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

const ALLOWED_SORT = {
  latest: { createdAt: -1 },
  deadline: { deadline: 1 },
  stipend: { stipend: -1 },
};

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

// @desc    Get all open jobs (home page)
// @route   GET /api/jobs
// @access  Public
// Query: page, limit, search, jobType, location, sort, accommodation
exports.getAllJobs = catchAsync(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
  const skip = (page - 1) * limit;

  const filter = {
    status: 'open',
    deadline: { $gt: new Date() },
  };

  if (req.query.jobType) {
    filter.jobType = req.query.jobType;
  }

  if (req.query.location) {
    filter.location = new RegExp(escapeRegex(req.query.location), 'i');
  }

  if (req.query.accommodation !== undefined) {
    filter.accommodation = req.query.accommodation === 'true';
  }

  if (req.query.search) {
    const term = String(req.query.search).trim();
    const regex = new RegExp(escapeRegex(term), 'i');

    const conditions = [
      { title: regex },
      { departments: regex },
      { description: regex },
    ];

    const num = Number(term);
    if (term !== '' && Number.isFinite(num)) {
      conditions.push({ stipend: num });
    }

    filter.$or = conditions;
  }

  const sort = ALLOWED_SORT[req.query.sort] || ALLOWED_SORT.latest;

  const [jobs, total] = await Promise.all([
    Job.find(filter)
      .select('title jobType location stipend deadline postedBy createdAt')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Job.countDocuments(filter),
  ]);

  // একসাথে সব company profile আনা (N+1 query এড়াতে)
  const posterIds = [...new Set(jobs.map((j) => String(j.postedBy)))];
  const companies = await CompanyProfile.find({ user: { $in: posterIds } })
    .select('user companyName isVerified')
    .lean();

  const companyMap = new Map(companies.map((c) => [String(c.user), c]));

  const data = jobs.map((job) => {
    const company = companyMap.get(String(job.postedBy));
    return {
      ...job,
      postedBy: company
        ? {
            id: company.user,
            companyName: company.companyName,
            isVerified: company.isVerified,
          }
        : null,
    };
  });

  return res.success(200, 'Jobs fetched successfully', {
    jobs: data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
    },
  });
});

// @desc    Jobs posted by the logged-in company, with applicant count
// @route   GET /api/applications/my-jobs
// @access  Private (company)
exports.myPostedJobs = catchAsync(async (req, res) => {
  const jobs = await Job.find({ postedBy: req.user.id })
    .select(
      'title jobType location stipend deadline status vacancies accommodation createdAt',
    )
    .sort({ createdAt: -1 })
    .lean();

  const jobIds = jobs.map((job) => job._id);

  // প্রতিটা job এর applicant সংখ্যা একবারে আনা (N+1 query এড়াতে)
  const counts = await Application.aggregate([
    { $match: { job: { $in: jobIds } } },
    { $group: { _id: '$job', count: { $sum: 1 } } },
  ]);

  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

  const data = jobs.map((job) => ({
    ...job,
    isApplicationOpen: job.status === 'open' && job.deadline > new Date(),
    applicantCount: countMap.get(String(job._id)) || 0,
  }));

  return res.success(200, 'Posted jobs fetched successfully', data);
});

// @desc    Delete own job (company owner only)
// @route   DELETE /api/jobs/:id
// @access  Private (company)
exports.deleteJob = catchAsync(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.error(400, 'Invalid job ID');
  }

  const job = await Job.findById(id);
  if (!job) {
    return res.error(404, 'Job not found');
  }

  if (String(job.postedBy) !== String(req.user.id)) {
    return res.error(403, 'You are not allowed to delete this job');
  }

  // Application থাকলে job delete করা যাবে না, শুধু close করা যাবে
  const applicantCount = await Application.countDocuments({ job: job._id });
  if (applicantCount > 0) {
    return res.error(
      400,
      'This job already has applications and cannot be deleted. Close it instead.',
    );
  }

  await job.deleteOne();

  return res.success(200, 'Job deleted successfully', null);
});
