function replaceAll(str, mapObj) {
  if (Object.keys(mapObj).length === 0) return str;
  const sortedKeys = Object.keys(mapObj).sort((a, b) => b.length - a.length);
  const matchedKeysRegExp = new RegExp(sortedKeys.join('|'), 'g');
  return str.replace(matchedKeysRegExp, matched => mapObj[matched]);
}
module.exports = { replaceAll };
