let authClient;
try {
  // Dynamic require — works if your bundler inlines better-auth/client
  const { createAuthClient } = require('better-auth/client');
  authClient = createAuthClient({
    baseURL: (typeof process !== 'undefined' && process.env?.VITE_API_URL)
      || 'http://localhost:3000',
    basePath: '/api/auth/better',
  });
} catch (_) {
  // In a pure Node/Express environment the client module is not needed.
  // Use toNodeHandler(auth) from 'better-auth/node' instead.
  authClient = null;
}

module.exports = { authClient };
