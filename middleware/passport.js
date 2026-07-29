const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const User = require('../models/User');
const { signToken } = require('./auth');
const { logAudit } = require('../utils/audit');

/**
 * Allowed email domain for Google OAuth login.
 * Defaults to ".ac.th" (Thai university standard).
 * Override with GOOGLE_OAUTH_ALLOWED_DOMAIN env var (e.g. ".rmutp.ac.th").
 */
const ALLOWED_DOMAIN = process.env.GOOGLE_OAUTH_ALLOWED_DOMAIN || '.ac.th';

const googleClientID =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID'
    ? process.env.GOOGLE_CLIENT_ID
    : 'placeholder-google-client-id';

const googleClientSecret =
  process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CLIENT_SECRET !== 'YOUR_GOOGLE_CLIENT_SECRET'
    ? process.env.GOOGLE_CLIENT_SECRET
    : 'placeholder-google-client-secret';

passport.use(
  new GoogleStrategy(
    {
      clientID: googleClientID,
      clientSecret: googleClientSecret,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3500/api/auth/google/callback',
      scope: ['profile', 'email'],
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const emails = profile.emails || [];
        const emailObj = emails.find((e) => e.verified) || emails[0];
        if (!emailObj) {
          return done(null, false, { message: 'no_email' });
        }

        const email = emailObj.value.toLowerCase();

        // ── Domain restriction ──────────────────────────────────────────────
        if (!email.endsWith(ALLOWED_DOMAIN)) {
          return done(null, false, { message: 'domain_not_allowed' });
        }

        const googleId = profile.id;
        const displayName = profile.displayName || email.split('@')[0];

        // Try to find by googleId first, then by email (link existing local account)
        let user = await User.findOne({ $or: [{ googleId }, { email }] });

        if (user) {
          // Link googleId if the user existed with only a local account
          if (!user.googleId) {
            user.googleId = googleId;
            user.authProvider = 'google';
            await user.save();
          }
          if (!user.isActive) {
            return done(null, false, { message: 'account_suspended' });
          }
        } else {
          // Auto-create new account for first-time Google sign-in
          user = await User.create({
            googleId,
            authProvider: 'google',
            fullName: displayName,
            email,
            role: 'graduate',
            isActive: true,
          });
        }

        const token = signToken(user);

        await logAudit({
          userId: user._id,
          action: 'login',
          targetType: 'user',
          targetId: user._id,
          metadata: { email: user.email, role: user.role, provider: 'google' },
        });

        return done(null, { user, token });
      } catch (err) {
        return done(err);
      }
    }
  )
);

// Minimal serialize/deserialize (sessions are only used for OAuth state, not for auth itself)
passport.serializeUser((data, done) => done(null, data));
passport.deserializeUser((data, done) => done(null, data));

module.exports = passport;
