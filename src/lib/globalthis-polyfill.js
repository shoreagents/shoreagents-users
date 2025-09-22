// Safe globalThis polyfill without dynamic code evaluation
(function() {
  'use strict';
  
  // Determine the global object based on environment
  var globalThisPolyfill;
  
  // Check for existing globalThis first
  if (typeof globalThis !== 'undefined') {
    globalThisPolyfill = globalThis;
  } 
  // Node.js environment (server-side)
  else if (typeof global !== 'undefined') {
    globalThisPolyfill = global;
    // Ensure self exists in Node.js but don't make it enumerable
    if (typeof global.self === 'undefined') {
      Object.defineProperty(global, 'self', {
        value: global,
        writable: true,
        configurable: true,
        enumerable: false
      });
    }
  }
  // Browser environment
  else if (typeof window !== 'undefined') {
    globalThisPolyfill = window;
  } 
  // Web Worker environment
  else if (typeof self !== 'undefined') {
    globalThisPolyfill = self;
  } 
  // Fallback - create minimal global
  else {
    globalThisPolyfill = {};
  }
  
  // Ensure globalThis property exists
  if (typeof globalThisPolyfill.globalThis === 'undefined') {
    Object.defineProperty(globalThisPolyfill, 'globalThis', {
      value: globalThisPolyfill,
      writable: true,
      configurable: true,
      enumerable: false
    });
  }
  
  // For browser environment, ensure self exists
  if (typeof window !== 'undefined' && typeof globalThisPolyfill.self === 'undefined') {
    Object.defineProperty(globalThisPolyfill, 'self', {
      value: globalThisPolyfill,
      writable: true,
      configurable: true,
      enumerable: false
    });
  }
  
  module.exports = globalThisPolyfill;
})();
