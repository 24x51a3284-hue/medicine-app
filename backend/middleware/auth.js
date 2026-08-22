const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config");

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    res.status(401).json({ message: "Invalid token" });
  }
}

// Role-based access levels
const ROLES = {
  USER: "USER",
  PHARMACY: "PHARMACY",
  STORE: "STORE",
  ADMIN: "ADMIN"
};

// Role hierarchy for authorization checks
const ROLE_PERMISSIONS = {
  [ROLES.USER]: ["getProfile", "updateProfile", "searchMedicines", "createReservation"],
  [ROLES.PHARMACY]: ["getProfile", "updateProfile", "manageInventory", "viewAnalytics", "manageReservations"],
  [ROLES.STORE]: ["getProfile", "updateProfile", "manageInventory", "viewAnalytics", "manageReservations"],
  [ROLES.ADMIN]: ["*"] // All permissions
};

// Check if user has required role/permission
function checkRole(requiredRole) {
  return (req, res, next) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) return res.status(401).json({ message: "No token provided" });

      req.user = jwt.verify(token, JWT_SECRET);
      const userRole = req.user.role ? req.user.role.toString().toUpperCase() : '';

      if (userRole === ROLES.ADMIN) {
        return next(); // Admin has all access
      }

      // Determine user's allowed permissions based on role
      const userPermissions = ROLE_PERMISSIONS[userRole] || [];

      // hasAccess: true if requesting PUBLIC access, or if user's permissions include the required role's main permission
      // For role-based access: USER can do USER actions, PHARMACY can do USER + PHARMACY actions, ADMIN does all
      const roleHierarchy = {
        [ROLES.USER]: [ROLES.USER],
        [ROLES.PHARMACY]: [ROLES.USER, ROLES.PHARMACY],
        [ROLES.ADMIN]: [ROLES.USER, ROLES.PHARMACY, ROLES.ADMIN]
      };

      const userAllowedRoles = roleHierarchy[userRole] || [];
      const hasAccess = userAllowedRoles.includes(requiredRole) || requiredRole === "PUBLIC";

      if (!hasAccess) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      next();
    } catch (e) {
      res.status(401).json({ message: "Invalid token" });
    }
  };
}

// Convenience middleware for specific roles
function isPharmacist(req, res, next) {
  return checkRole(ROLES.PHARMACY)(req, res, next);
}

function isAdmin(req, res, next) {
  return checkRole(ROLES.ADMIN)(req, res, next);
}

function isUser(req, res, next) {
  return checkRole(ROLES.USER)(req, res, next);
}

module.exports = { authMiddleware, checkRole, ROLES, isPharmacist, isAdmin, isUser };
