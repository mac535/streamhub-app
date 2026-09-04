const { error } = require('../utils/response');

/**
 * Force Password Reset Middleware.
 * 
 * Blocks access to protected routes if the user's account
 * has `mustChangePassword: true`. This forces seeded accounts
 * (with generic passwords) to set a new password on first login.
 * 
 * Exceptions (routes that are allowed through):
 *   - PUT /api/auth/change-password (so they CAN change the password)
 *   - GET /api/auth/me (so the frontend can read the flag)
 * 
 * Usage: Apply AFTER `authenticate` middleware on protected routes.
 */
function forcePasswordReset(req, res, next) {
  // Allow password change and profile fetch through
  const exemptPaths = [
    { method: 'PUT', path: '/api/auth/change-password' },
    { method: 'GET', path: '/api/auth/me' },
  ];

  const isExempt = exemptPaths.some(
    (ep) => req.method === ep.method && req.originalUrl.startsWith(ep.path)
  );

  if (isExempt) {
    return next();
  }

  if (req.user && req.user.mustChangePassword) {
    return error(
      res,
      'You must change your password before accessing the dashboard.',
      403,
      { mustChangePassword: true }
    );
  }

  next();
}

module.exports = { forcePasswordReset };
