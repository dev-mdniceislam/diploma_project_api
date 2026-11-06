const Job = require('../model/jobPostModel');
const catchAsync = require('../utils/catchAsync');

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
    postedBy: req.user._id,
  });

  return res.success(201, 'Job posted successfully', job);
});

exports.getJobById = catchAsync(async (req, res) => {
  const { id } = req.params;

  // Invalid ID hole DB-te query na kore aage-i reject korun
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.error(400, 'Invalid job ID');
  }

  const job = await Job.findById(id).populate({
    path: 'postedBy',
    select: 'name companyName logo isVerified', // User model-e ja ache shudhu seta-i
  });

  if (!job) {
    return res.error(404, 'Job not found');
  }

  const now = new Date();
  const isApplicationOpen = job.status === 'open' && job.deadline > now;

  return res.success(200, 'Job fetched successfully', {
    ...job.toObject(),
    isApplicationOpen,
  });
});
