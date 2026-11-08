const Application = require('../model/applicationModel');
const Job = require('../model/jobPostModel');
const StudentProfile = require('../model/profileModel');
const catchAsync = require('../utils/catchAsync');
const deleteFileFromCloudinary = require('../middleware/fileDeleteMiddleware');
const getPublicIdFromUrl = require('../middleware/getPublicIdFromURL');
const mongoose = require('mongoose');

// @desc    Student's own applications
// @route   GET /api/applications/me
// @access  Private (student)
exports.myApplications = catchAsync(async (req, res) => {
  const studentProfile = await StudentProfile.findOne({ user: req.user.id });
  if (!studentProfile) {
    return res.error(404, 'Student profile not found');
  }

  const apps = await Application.find({ applicant: studentProfile._id })
    .populate({
      path: 'job',
      select: 'title jobType postedBy',
    })
    .sort({ createdAt: -1 });

  return res.success(200, 'Applications fetched successfully', apps);
});

// @desc    Apply to a job
// @route   POST /api/applications/:jobId
// @access  Private (student)
exports.applyToJob = catchAsync(async (req, res) => {
  const { jobId } = req.params;

  const job = await Job.findById(jobId);
  if (!job) {
    return res.error(404, 'Job not found');
  }

  if (job.status !== 'open' || job.deadline <= new Date()) {
    return res.error(400, 'Application deadline is over for this job');
  }

  const studentProfile = await StudentProfile.findOne({ user: req.user.id });
  if (!studentProfile) {
    return res.error(404, 'Student profile not found');
  }

  const cv = req.file?.path || studentProfile.cvUrl || '';

  if (!cv) {
    return res.error(400, 'CV is required to apply');
  }

  try {
    const application = await Application.create({
      job: job._id,
      applicant: studentProfile._id,
      company: job.postedBy,
      shortMessage: req.body.message?.trim() || '',
      cv,
    });

    return res.success(201, 'Job applied successfully', application);
  } catch (err) {
    if (req.file?.filename) {
      await deleteFileFromCloudinary(req.file.filename);
    }
    if (err.code === 11000) {
      return res.error(409, 'You have already applied to this job');
    }

    throw err;
  }
});

// @desc    Applicants of a job (job owner company only)
// @route   GET /api/applications/job/:jobId
// @access  Private (company)
exports.jobApplicants = catchAsync(async (req, res) => {
  const job = await Job.findById(req.params.jobId);
  if (!job) {
    return res.error(404, 'Job not found');
  }

  if (job.postedBy.toString() !== req.user.id) {
    return res.error(403, 'You are not allowed to view applicants of this job');
  }

  const applicants = await Application.find({ job: job.id })
    .populate({
      path: 'applicant',
      select: 'name email education profilePic',
    })
    .sort({ createdAt: -1 });

  return res.success(200, 'Applicants fetched successfully', applicants);
});

// @desc    All applications received by the logged-in company (across all its jobs)
// @route   GET /api/applications/company
// @access  Private (company)
exports.companyApplications = catchAsync(async (req, res) => {
  const { status, jobId } = req.query;

  const filter = { company: req.user.id };

  if (status) {
    filter.status = status;
  }

  if (jobId) {
    filter.job = jobId;
  }

  const applications = await Application.find(filter)
    .populate({
      path: 'job',
      select: 'title jobType location deadline status',
    })
    .populate({
      path: 'applicant',
      select: 'name email education avatarUrl',
    })
    .select('-__v')
    .sort({ createdAt: -1 })
    .lean();

  return res.success(200, 'Applications fetched successfully', applications);
});

// @desc    Student withdraws own application
// @route   DELETE /api/applications/:id
// @access  Private (student)
exports.withdrawApplication = catchAsync(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.error(400, 'Invalid application ID');
  }

  const studentProfile = await StudentProfile.findOne({
    user: req.user.id,
  }).lean();
  if (!studentProfile) {
    return res.error(404, 'Student profile not found');
  }

  const application = await Application.findById(id);
  if (!application) {
    return res.error(404, 'Application not found');
  }

  // শুধু নিজের application delete করা যাবে
  if (String(application.applicant) !== String(studentProfile._id)) {
    return res.error(403, 'You are not allowed to withdraw this application');
  }

  // Shortlisted/hired application withdraw করতে দেওয়া হবে না
  if (['shortlisted', 'hired'].includes(application.status)) {
    return res.error(400, 'This application can no longer be withdrawn');
  }

  const cvPublicId = getPublicIdFromUrl(application.cv);

  await application.deleteOne();

  // Application মুছে যাওয়ার পর CV মোছা হবে
  if (cvPublicId) {
    await deleteFileFromCloudinary(cvPublicId);
  }

  return res.success(200, 'Application withdrawn successfully', null);
});
