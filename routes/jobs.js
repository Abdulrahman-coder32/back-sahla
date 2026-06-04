const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const JobListing = require('../models/JobListing');

// إنشاء وظيفة
router.post('/create', auth, async (req, res) => {
  try {
    if (req.user.role !== 'shop_owner') {
      return res.status(403).json({ msg: 'غير مصرح - يجب أن تكون صاحب عمل' });
    }

    const job = new JobListing({
      shop_name: req.body.shop_name,
      category: req.body.category,
      governorate: req.body.governorate,
      city: req.body.city,
      requirements: req.body.requirements,
      working_hours: req.body.working_hours,
      salary: req.body.salary || '',
      owner_id: req.user.id
    });

    await job.save();

    const populatedJob = await JobListing.findById(job._id)
      .populate('owner_id', 'shop_name profileImage cacheBuster');

    res.json(populatedJob);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'خطأ في السيرفر' });
  }
});

// البحث
router.post('/', async (req, res) => {
  try {
    const filters = req.body || {};
    const query = {};

    if (filters.governorate) query.governorate = filters.governorate;
    if (filters.city) query.city = filters.city;
    if (filters.category) query.category = new RegExp(filters.category, 'i');

    const jobs = await JobListing.find(query)
      .sort({ createdAt: -1 })
      .populate('owner_id', 'shop_name profileImage cacheBuster');

    res.json(jobs);
  } catch (err) {
    res.status(500).json({ msg: 'خطأ في السيرفر' });
  }
});

// وظائفي
router.get('/my', auth, async (req, res) => {
  try {
    const jobs = await JobListing.find({ owner_id: req.user.id })
      .sort({ createdAt: -1 })
      .populate('owner_id', 'shop_name profileImage cacheBuster');

    res.json(jobs);
  } catch (err) {
    res.status(500).json({ msg: 'خطأ' });
  }
});

// تفاصيل وظيفة
router.get('/:id', async (req, res) => {
  try {
    const job = await JobListing.findById(req.params.id)
      .populate('owner_id', 'shop_name profileImage cacheBuster');

    if (!job) return res.status(404).json({ msg: 'غير موجودة' });

    res.json(job);
  } catch (err) {
    res.status(500).json({ msg: 'خطأ في السيرفر' });
  }
});

// حذف
router.delete('/:id', auth, async (req, res) => {
  try {
    const job = await JobListing.findById(req.params.id);

    if (!job) return res.status(404).json({ msg: 'غير موجودة' });

    if (job.owner_id.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'غير مصرح' });
    }

    await job.deleteOne();

    res.json({ msg: 'تم الحذف' });
  } catch (err) {
    res.status(500).json({ msg: 'خطأ في السيرفر' });
  }
});

module.exports = router;
