const { verifyToken } = require('../utils/token');
const { error } = require('../utils/response');
const { db } = require('../config/database');

/**
 * Authentication middleware.
 * Verifies JWT from Authorization header and attaches user to request.
 */
async function authenticate(req, res, next) {
  try {
    let token;
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return error(res, 'Authentication required. Please provide a valid token.', 401);
    }

    const decoded = verifyToken(token);

    // Fetch fresh user data to ensure account is still active
    const user = db.users.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        avatar: true,
        isActive: true,
        assignedBrcs: true,
        mustChangePassword: true,
      },
    });

    if (!user) {
      return error(res, 'User account not found.', 401);
    }

    if (!user.isActive) {
      return error(res, 'Your account has been deactivated. Contact an administrator.', 403);
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(res, 'Token has expired. Please sign in again.', 401);
    }
    if (err.name === 'JsonWebTokenError') {
      return error(res, 'Invalid token. Please sign in again.', 401);
    }
    return error(res, 'Authentication failed.', 401);
  }
}

/**
 * Role-Based Access Control (RBAC) middleware factory.
 * Restricts route access to users with specified roles.
 *
 * @param {...string} allowedRoles - Roles permitted to access the route
 * @returns {Function} Express middleware
 *
 * @example
 * router.get('/admin-only', authenticate, authorize('ADMIN'), controller);
 * router.get('/multi-role', authenticate, authorize('ADMIN', 'EXPERT'), controller);
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return error(res, 'Authentication required.', 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return error(
        res,
        `Access denied. This resource requires one of the following roles: ${allowedRoles.join(', ')}`,
        403
      );
    }

    next();
  };
}

module.exports = { authenticate, authorize };
