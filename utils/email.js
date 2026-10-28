function isAsciiAlphaNumeric(charCode) {
  return (
    (charCode >= 48 && charCode <= 57) // 0-9
    || (charCode >= 65 && charCode <= 90) // A-Z
    || (charCode >= 97 && charCode <= 122) // a-z
  );
}

function hasOnlyAllowedLocalChars(localPart) {
  const extra = "!#$%&'*+/=?^_`{|}~.-";
  for (let i = 0; i < localPart.length; i += 1) {
    const code = localPart.charCodeAt(i);
    if (isAsciiAlphaNumeric(code)) continue;
    if (extra.includes(localPart[i])) continue;
    return false;
  }
  return true;
}

function hasOnlyAllowedDomainChars(domainPart) {
  for (let i = 0; i < domainPart.length; i += 1) {
    const code = domainPart.charCodeAt(i);
    const ch = domainPart[i];
    if (isAsciiAlphaNumeric(code) || ch === '-' || ch === '.') continue;
    return false;
  }
  return true;
}

function hasValidDomainLabels(domainPart) {
  const labels = domainPart.split('.');
  if (labels.length < 2) return false;
  for (const label of labels) {
    if (!label) return false;
    if (label.startsWith('-') || label.endsWith('-')) return false;
  }
  return true;
}

function isValidEmailAddress(value) {
  if (typeof value !== 'string') return false;
  const email = value.trim();
  if (!email || email.length > 254) return false;

  const atIndex = email.indexOf('@');
  if (atIndex <= 0 || atIndex !== email.lastIndexOf('@') || atIndex >= email.length - 1) {
    return false;
  }

  const localPart = email.slice(0, atIndex);
  const domainPart = email.slice(atIndex + 1);

  if (localPart.length > 64 || domainPart.length > 253) return false;
  if (localPart.startsWith('.') || localPart.endsWith('.')) return false;
  if (domainPart.startsWith('.') || domainPart.endsWith('.')) return false;
  if (localPart.includes('..') || domainPart.includes('..')) return false;
  if (!hasOnlyAllowedLocalChars(localPart)) return false;
  if (!hasOnlyAllowedDomainChars(domainPart)) return false;
  if (!hasValidDomainLabels(domainPart)) return false;

  return true;
}

module.exports = { isValidEmailAddress };
