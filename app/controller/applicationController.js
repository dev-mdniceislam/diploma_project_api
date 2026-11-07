const Application = require('../model/applicationModel');
const Job = require('../model/jobPostModel');
const StudentProfile = require('../model/profileModel');
const catchAsync = require('../utils/catchAsync');

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
      select: 'title jobType location postedBy',
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

  try {
    const application = await Application.create({
      job: job._id,
      applicant: studentProfile._id,
      company: job.postedBy,
      letter: req.body.coverNote,
    });

    return res.success(201, 'Job applied successfully', application);
  } catch (err) {
    // Unique index (job + applicant): ager apply kora thakle 11000 ashbe
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
