const Department = require('../models/Department');
const Category = require('../models/Category');
const Tag = require('../models/Tag');
const catalog = require('../data/departmentCatalog');

/**
 * Adds only missing catalog records.  It never deletes or changes user-created tags,
 * so it is safe to run during every database initialization.
 */
async function seedDepartmentCatalog() {
  const result = { departments: 0, categories: 0, tags: 0 };

  for (const entry of catalog) {
    let department = await Department.findOne({ name: entry.department });
    if (!department) {
      department = await Department.create({ name: entry.department, isActive: entry.isActive });
      result.departments += 1;
    }

    for (const categoryName of entry.categories) {
      let category = await Category.findOne({ name: categoryName });
      if (!category) {
        category = await Category.create({
          name: categoryName,
          departments: [department._id],
          isActive: entry.isActive,
        });
        result.categories += 1;
      } else if (!(category.departments || []).some((id) => String(id) === String(department._id))) {
        if (!category.departments) category.departments = [];
        category.departments.addToSet(department._id);
        await category.save();
      }

      // A standard tag is created for each supplied category and is scoped to it.
      // User-created tags have createdBy set and are never touched by this seed.
      const standardTag = await Tag.findOne({
        department: department._id,
        category: category._id,
        name: categoryName,
      });
      if (!standardTag) {
        await Tag.create({ name: categoryName, department: department._id, category: category._id });
        result.tags += 1;
      }
    }
  }

  return result;
}

module.exports = { seedDepartmentCatalog };
