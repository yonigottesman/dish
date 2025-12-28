// This file runs before Next.js initializes to fix the broken localStorage
// that Cursor IDE injects via --localstorage-file flag

export async function register() {
  // Fix the broken localStorage on the server
  // Cursor IDE passes --localstorage-file without a valid path,
  // creating an empty object without the standard localStorage methods
  if (typeof localStorage !== 'undefined' && typeof localStorage.getItem !== 'function') {
    // Replace with a proper no-op implementation
    const noopStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    };
    
    // @ts-ignore - We need to override the broken global
    globalThis.localStorage = noopStorage;
  }
}
