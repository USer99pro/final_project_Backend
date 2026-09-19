'use strict';

/**
 * lib/auth-client.js — Better Auth browser client for Express (CommonJS)
 *
 * For a PURE Express backend (no framework frontend bundler), this module is
 * intended for import in browser-side JS served from this backend or in a
 * separate frontend build step.
 *
 * If you are using a separate frontend (React/Vue/Svelte etc.), copy this
 * pattern into that project instead.
 *
 * Usage (browser / bundled frontend):
 *   import { authClient } from './lib/auth-client.js';
 *   await authClient.signIn.email({ email, password });
 *
 * For server-side usage from this Express backend, use lib/auth.js directly.
 */

// NOTE: better-auth/client uses ESM internally.
// For a CommonJS Express backend you typically do NOT need this file —
// use toNodeHandler(auth) from better-auth/node on the server side instead.
// This file is kept here as a reference / for use in a bundled frontend.

// ESM import (use in a bundled frontend with type: "module"):
// import { createAuthClient } from 'better-auth/client';
// export const authClient = createAuthClient({
//   baseURL: process.env.VITE_API_URL || 'http://localhost:3000',
// });

// CommonJS shim for environments that support it:
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
