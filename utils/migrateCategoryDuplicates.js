const Category = require('../models/Category');
const Content = require('../models/Content');
const Tag = require('../models/Tag');

/** Merge legacy category rows that have the same name into one multi-department row. */
async function migrateCategoryDuplicates() {
  const categories = await Category.collection.find({}).toArray();
  const groups = new Map();
  for (const category of categories) {
    const key = String(category.name || '').trim();
    if (!key) continue;
    groups.set(key, [...(groups.get(key) || []), category]);
  }

  let merged = 0;
  for (const sameName of groups.values()) {
    const canonical = sameName[0];
    const departmentIds = [];
    for (const category of sameName) {
      const values = [...(Array.isArray(category.departments) ? category.departments : []), category.department];
      for (const departmentId of values) {
        if (departmentId && !departmentIds.some((id) => String(id) === String(departmentId))) {
          departmentIds.push(departmentId);
        }
      }
    }

    await Category.collection.updateOne(
      { _id: canonical._id },
      { $set: { departments: departmentIds }, $unset: { department: '' } }
    );

    const duplicateIds = sameName.slice(1).map((category) => category._id);
    if (!duplicateIds.length) continue;

    await Content.updateMany({ category: { $in: duplicateIds } }, { $set: { category: canonical._id } });
    await Tag.updateMany({ category: { $in: duplicateIds } }, { $set: { category: canonical._id } });
    await Category.collection.deleteMany({ _id: { $in: duplicateIds } });
    merged += duplicateIds.length;
  }
  return merged;
}

module.exports = { migrateCategoryDuplicates };
