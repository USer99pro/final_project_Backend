const mongoose = require('mongoose');
const crypto = require('crypto');

const refreshTokenSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, index: true },           // SHA-256 hashed token
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    expiresAt: { type: Date, required: true },
    isRevoked: { type: Boolean, default: false },
    family: { type: String, required: true, index: true },          // Token family for rotation detection
    replacedBy: { type: String, default: null },                    // Hash of the replacement token (rotation chain)
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'refresh_tokens' }
);

// TTL index — MongoDB จะลบ document อัตโนมัติเมื่อ expiresAt ถึง
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Hash a raw refresh token string using SHA-256.
 * We never store the raw token — only the hash.
 */
refreshTokenSchema.statics.hashToken = function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
};

/**
 * Generate a cryptographically secure random token (base64url, 64 bytes).
 */
refreshTokenSchema.statics.generateRaw = function generateRaw() {
  return crypto.randomBytes(64).toString('base64url');
};

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
