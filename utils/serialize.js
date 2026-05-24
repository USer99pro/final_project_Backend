function stripVersion(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject() : { ...doc };
  delete o.__v;
  if (o.password !== undefined) delete o.password;
  return o;
}

module.exports = { stripVersion };
