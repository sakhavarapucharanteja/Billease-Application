
const { ObjectId } = require("mongodb");
const {
  hashPassword,
  verifyPassword,
  createAuthToken,
  authenticateToken,
} = require("./auth.cjs");

function registerAuthRoutes(app, db) {
  const businesses = db.collection("businesses");
  const users = db.collection("users");

  async function ensureAuthIndexes() {
    await users.createIndex(
      { email: 1 },
      { unique: true, name: "unique_user_email" }
    );
  }

  // Register a new user and business.
  // New businesses remain pending until an administrator approves them.
  app.post("/api/auth/register", async (req, res) => {
    let createdBusinessId = null;
    let createdUserId = null;

    try {
      const businessName =
        typeof req.body?.businessName === "string"
          ? req.body.businessName.trim()
          : "";

      const ownerName =
        typeof req.body?.ownerName === "string"
          ? req.body.ownerName.trim()
          : "";

      const email =
        typeof req.body?.email === "string"
          ? req.body.email.trim().toLowerCase()
          : "";

      const password =
        typeof req.body?.password === "string"
          ? req.body.password
          : "";

      if (!businessName || !ownerName || !email || !password) {
        return res.status(400).json({
          success: false,
          message:
            "Business name, owner name, email, and password are required.",
        });
      }

      if (
        businessName.length > 120 ||
        ownerName.length > 100 ||
        email.length > 254
      ) {
        return res.status(400).json({
          success: false,
          message: "One or more fields are too long.",
        });
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid email address.",
        });
      }

      if (password.length < 8 || password.length > 128) {
        return res.status(400).json({
          success: false,
          message: "Password must contain 8 to 128 characters.",
        });
      }

      const existingUser = await users.findOne({ email });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "An account with this email already exists.",
        });
      }

      const now = new Date();

      const businessResult = await businesses.insertOne({
        name: businessName,
        status: "pending",
        approvalRequestedAt: now,
        approvedAt: null,
        approvedBy: null,
        createdAt: now,
        updatedAt: now,
      });

      createdBusinessId = businessResult.insertedId;

      const passwordHash = await hashPassword(password);

      const userResult = await users.insertOne({
        businessId: createdBusinessId,
        name: ownerName,
        email,
        passwordHash,
        role: "owner",
        createdAt: now,
      });

      createdUserId = userResult.insertedId;

      return res.status(201).json({
        success: true,
        status: "pending",
        message:
          "Your account has been created. Your business is awaiting BillEase administrator approval. You can log in after approval.",
        user: {
          id: String(userResult.insertedId),
          name: ownerName,
          email,
          role: "owner",
        },
        business: {
          id: String(createdBusinessId),
          name: businessName,
          status: "pending",
        },
      });
    } catch (error) {
      // Clean up a partially created registration.
      if (createdUserId) {
        try {
          await users.deleteOne({ _id: createdUserId });
        } catch (cleanupError) {
          console.error(
            "User registration cleanup failed:",
            cleanupError.message
          );
        }
      }

      if (createdBusinessId) {
        try {
          await businesses.deleteOne({ _id: createdBusinessId });
        } catch (cleanupError) {
          console.error(
            "Business registration cleanup failed:",
            cleanupError.message
          );
        }
      }

      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "An account with this email already exists.",
        });
      }

      console.error("Registration error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Could not create the account. Please try again.",
      });
    }
  });

  // Login only when the user's business has been approved.
  app.post("/api/auth/login", async (req, res) => {
    try {
      const email =
        typeof req.body?.email === "string"
          ? req.body.email.trim().toLowerCase()
          : "";

      const password =
        typeof req.body?.password === "string"
          ? req.body.password
          : "";

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Email and password are required.",
        });
      }

      const user = await users.findOne({ email });

      if (!user || !(await verifyPassword(password, user.passwordHash))) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password.",
        });
      }

      if (!user.businessId || !ObjectId.isValid(String(user.businessId))) {
        return res.status(403).json({
          success: false,
          message: "This account is not linked to a valid business.",
        });
      }

      const business = await businesses.findOne({
        _id: new ObjectId(String(user.businessId)),
      });

      if (!business) {
        return res.status(403).json({
          success: false,
          message: "Business account not found.",
        });
      }

      if (business.status !== "active") {
        const status = business.status || "pending";

        return res.status(403).json({
          success: false,
          status,
          message:
            status === "rejected"
              ? "Your business registration was not approved. Please contact BillEase support."
              : "Your business is awaiting approval. You can log in after BillEase approves your account.",
        });
      }

      const token = createAuthToken(user);

      return res.json({
        success: true,
        message: "Login successful.",
        token,
        user: {
          id: String(user._id),
          name: user.name,
          email: user.email,
          role: user.role,
        },
        business: {
          id: String(business._id),
          name: business.name,
          status: business.status,
        },
      });
    } catch (error) {
      console.error("Login error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Could not log in. Please try again.",
      });
    }
  });

  // Verify the current session and re-check business approval.
  app.get("/api/auth/me", authenticateToken, async (req, res) => {
    try {
      if (
        !ObjectId.isValid(req.auth.userId) ||
        !ObjectId.isValid(req.auth.businessId)
      ) {
        return res.status(401).json({
          success: false,
          message: "Invalid account session.",
        });
      }

      const user = await users.findOne({
        _id: new ObjectId(req.auth.userId),
        businessId: new ObjectId(req.auth.businessId),
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Account not found. Please log in again.",
        });
      }

      const business = await businesses.findOne({
        _id: new ObjectId(req.auth.businessId),
      });

      if (!business) {
        return res.status(403).json({
          success: false,
          message: "Business account not found.",
        });
      }

      if (business.status !== "active") {
        return res.status(403).json({
          success: false,
          status: business.status || "pending",
          message:
            "This business is not approved for BillEase access.",
        });
      }

      return res.json({
        success: true,
        user: {
          id: String(user._id),
          name: user.name,
          email: user.email,
          role: user.role,
        },
        business: {
          id: String(business._id),
          name: business.name,
          status: business.status,
        },
      });
    } catch (error) {
      console.error("Session check error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Could not verify the current session.",
      });
    }
  });

  return { ensureAuthIndexes };
}

module.exports = { registerAuthRoutes };
