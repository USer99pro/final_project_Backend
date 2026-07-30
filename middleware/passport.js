const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const User = require('../models/User');
const { signToken, generateRefreshToken } = require('./auth');
const { logAudit } = require('../utils/audit');

/**
 * Allowed email domain for Google OAuth login.
 * Defaults to ".ac.th" (Thai university standard).
 * Override with GOOGLE_OAUTH_ALLOWED_DOMAIN env var (e.g. ".rmutp.ac.th").
 */
const ALLOWED_DOMAIN = process.env.GOOGLE_OAUTH_ALLOWED_DOMAIN || '.ac.th';

// ── Validate Google OAuth configuration ─────────────────────────────────────
const googleClientID = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

const isGoogleConfigured =
  googleClientID &&
  googleClientID !== 'YOUR_GOOGLE_CLIENT_ID' &&
  googleClientID !== 'placeholder-google-client-id' &&
  googleClientSecret &&
  googleClientSecret !== 'YOUR_GOOGLE_CLIENT_SECRET' &&
  googleClientSecret !== 'placeholder-google-client-secret';

if (isGoogleConfigured) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: googleClientID,
        clientSecret: googleClientSecret,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3500/api/auth/google/callback',
        scope: ['profile', 'email'],
        passReqToCallback: true, // ให้ req ส่งมาด้วยเพื่อสร้าง refresh token
      },
      async (req, _accessToken, _refreshToken, profile, done) => {
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

          const accessToken = signToken(user);
          const refreshToken = await generateRefreshToken(user, req);

          await logAudit({
            userId: user._id,
            action: 'login',
            targetType: 'user',
            targetId: user._id,
            metadata: { email: user.email, role: user.role, provider: 'google' },
            req,
          });

          return done(null, { user, accessToken, refreshToken });
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  console.log('✅ Google OAuth strategy registered');
} else {
  console.warn('⚠️  Google OAuth ยังไม่ได้ตั้งค่า — ตั้งค่า GOOGLE_CLIENT_ID และ GOOGLE_CLIENT_SECRET ใน .env');
}

// Minimal serialize/deserialize (sessions are only used for OAuth state, not for auth itself)
passport.serializeUser((data, done) => done(null, data));
passport.deserializeUser((data, done) => done(null, data));

module.exports = passport;
