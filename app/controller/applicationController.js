const Application = require('../model/applicationModel');

exports.myApplications = async (req, res) => {
  const apps = await Application.find({ applicant: req.user._id })
    .populate({
      path: 'job',
      select: 'title type location postedBy', // attachment ba job dui-i ekhane ashbe
    })
    .sort({ createdAt: -1 });

  res.json(apps);
};

// apply job
exports.applyToJob = async (req, res) => {
  const { jobId } = req.params;
  const studentId = req.user._id; // JWT middleware theke

  const job = await Job.findById(jobId);
  if (!job) return res.status(404).json({ message: 'Job not found' });

  try {
    const application = await Application.create({
      job: job._id,
      applicant: studentId,
      company: job.postedBy,
      letter: req.body.coverNote,
    });
    res.success(200, 'Job apply successfully', application);
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ message: 'Apni agei ei job-e apply korechen' });
    }
    throw err;
  }
};
