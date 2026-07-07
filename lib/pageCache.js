// Pure in-memory (module-level) cache.
// - Tab switch (Home <-> History) via client-side navigation: JS runtime
//   stays alive, so this cache survives -> no skeleton flash again.
// - Full page reload (F5 / fresh open): JS runtime restarts, this object
//   is recreated empty -> skeleton loader shows again, as it should.
const cache = {};

export function getCached(key) {
  return cache[key];
}

export function setCached(key, data) {
  cache[key] = data;
}
