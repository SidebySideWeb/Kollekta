function normalizeTags(input) {
  if (input === undefined || input === null || input === '') return null;
  const tags = String(input)
    .split(/[,;]/)
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(tags)].join(',') || null;
}

function parseTags(tagsString) {
  if (!tagsString) return [];
  return tagsString.split(',').map((t) => t.trim()).filter(Boolean);
}

function normalizeTagList(tags) {
  if (!Array.isArray(tags)) return null;
  const normalized = tags
    .map((tag) => String(tag).trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(normalized)].join(',') || null;
}

function customerHasVisibilityTag(customerTagsString, visibilityTagsString) {
  const required = parseTags(visibilityTagsString).map((t) => t.toLowerCase());
  if (required.length === 0) return false;
  const customerTags = new Set(parseTags(customerTagsString).map((t) => t.toLowerCase()));
  return required.some((tag) => customerTags.has(tag));
}

function applyTagsUpdate(existingTags, incomingTags, mode = 'set') {
  const current = parseTags(existingTags).map((t) => t.toLowerCase());
  const incoming = parseTags(
    Array.isArray(incomingTags) ? incomingTags.join(',') : incomingTags
  ).map((t) => t.toLowerCase());

  if (mode === 'add') {
    return normalizeTags([...current, ...incoming].join(','));
  }
  if (mode === 'remove') {
    const remove = new Set(incoming);
    return normalizeTags(current.filter((tag) => !remove.has(tag)).join(','));
  }
  return normalizeTags(incoming.join(','));
}

module.exports = {
  normalizeTags,
  parseTags,
  normalizeTagList,
  customerHasVisibilityTag,
  applyTagsUpdate,
};
