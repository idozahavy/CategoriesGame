/**
 * Node lacks some browser globals that modules read at import time
 * (i18n picks the UI language from navigator.languages). Node ≥21 provides
 * navigator natively; this shim only fills the gap on older runtimes.
 */
if (!('navigator' in globalThis)) {
  Object.defineProperty(globalThis, 'navigator', {
    value: { languages: ['en'] },
    configurable: true,
  });
}
