
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

function createAuthToken(user) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured.");
  }

  if (!user?._id || !user?.businessId) {
    throw new Error("User ID and business ID are required.");
  }

  return jwt.sign(
    {
      userId: String(user._id),
      businessId: String(user.businessId),
    },
    secret,
    {
      expiresIn: "2h",
      issuer: "billease",
      audience: "billease-users",
    }
  );
}

function verifyAuthToken(token) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return jwt.verify(token, secret, {
    issuer: "billease",
    audience: "billease-users",
  });
}

function authenticateToken(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Please log in to continue.",
    });
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication token is missing.",
    });
  }

  try {
    const payload = verifyAuthToken(token);

    if (
      typeof payload.userId !== "string" ||
      !payload.userId ||
      typeof payload.businessId !== "string" ||
      !payload.businessId
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }

    req.auth = {
      userId: payload.userId,
      businessId: payload.businessId,
    };

    next();
  } catch (error) {
    if (
      error.name === "TokenExpiredError" ||
      error.name === "JsonWebTokenError" ||
      error.name === "NotBeforeError"
    ) {
      return res.status(401).json({
        success: false,
        message: "Your session is invalid or expired. Please log in again.",
      });
    }

    console.error("Authentication error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Authentication could not be completed.",
    });
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  createAuthToken,
  verifyAuthToken,
  authenticateToken,
};
