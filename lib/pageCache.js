// Module-level cache. Survives client-side route changes (Home <-> History)
// because Next.js keeps the same JS runtime alive during SPA navigation.
// It resets on a full page reload, which is expected.
const cache = {};

export function getCached(key) {
  return cache[key];
}

export function setCached(key, data) {
  cache[key] = data;
}
