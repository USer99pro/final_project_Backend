const express = require('express');
const Department = require('../models/Department');
const Category = require('../models/Category');
const Tag = require('../models/Tag');

const router = express.Router();

// Returns the joined data needed by the department/category/tag selectors.
router.get('/', async (_req, res) => {
  try {
    const departments = await Department.find({ isActive: true }).sort({ name: 1 }).lean();
    const departmentIds = departments.map((department) => department._id);
    const categories = await Category.find({ departments: { $in: departmentIds }, isActive: true })
      .sort({ name: 1 })
      .lean();
    const categoryIds = categories.map((category) => category._id);
    const tags = await Tag.find({
      $or: [
        { department: { $in: departmentIds }, category: null },
        { category: { $in: categoryIds } },
        { department: null, category: null }, // user-created general tags
      ],
    })
      .sort({ name: 1 })
      .lean();

    const tagsByCategory = new Map();
    const tagsByDepartment = new Map();
    const generalTags = [];
    for (const tag of tags) {
      if (tag.category) {
        const key = tag.category.toString();
        tagsByCategory.set(key, [...(tagsByCategory.get(key) || []), tag]);
      } else if (tag.department) {
        const key = tag.department.toString();
        tagsByDepartment.set(key, [...(tagsByDepartment.get(key) || []), tag]);
      } else {
        generalTags.push(tag);
      }
    }

    res.json(
      departments.map((department) => ({
        ...department,
        categories: categories
          .filter((category) => category.departments.some((id) => id.toString() === department._id.toString()))
          .map((category) => ({
            ...category,
            tags: [...(tagsByCategory.get(category._id.toString()) || []), ...generalTags],
          })),
        tags: [...(tagsByDepartment.get(department._id.toString()) || []), ...generalTags],
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
