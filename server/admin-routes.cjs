
const { ObjectId } = require("mongodb");
const {
  verifyPassword,
  createAuthToken,
  authenticateToken,
} = require("./auth.cjs");

function registerAdminRoutes(app, db) {
  const users = db.collection("users");
  const businesses = db.collection("businesses");

  // Admin login. Only an existing platformAdmin account can log in.
  app.post("/api/admin/login", async (req, res) => {
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

      const admin = await users.findOne({
        email,
        role: "platformAdmin",
      });

      if (
        !admin ||
        !(await verifyPassword(password, admin.passwordHash))
      ) {
        return res.status(401).json({
          success: false,
          message: "Invalid admin email or password.",
        });
      }

      if (
        !admin.businessId ||
        !ObjectId.isValid(String(admin.businessId))
      ) {
        return res.status(403).json({
          success: false,
          message: "Admin account is not configured correctly.",
        });
      }

      const token = createAuthToken(admin);

      return res.json({
        success: true,
        message: "Admin login successful.",
        token,
        admin: {
          id: String(admin._id),
          name: admin.name,
          email: admin.email,
          role: admin.role,
        },
      });
    } catch (error) {
      console.error("Admin login error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Could not log in. Please try again.",
      });
    }
  });

  // Protect all admin management routes.
  function requirePlatformAdmin(req, res, next) {
    authenticateToken(req, res, async () => {
      try {
        if (!ObjectId.isValid(req.auth?.userId)) {
          return res.status(401).json({
            success: false,
            message: "Invalid admin session.",
          });
        }

        const admin = await users.findOne({
          _id: new ObjectId(req.auth.userId),
          role: "platformAdmin",
        });

        if (!admin) {
          return res.status(403).json({
            success: false,
            message: "Platform administrator access is required.",
          });
        }

        next();
      } catch (error) {
        console.error("Admin authorization error:", error.message);

        return res.status(500).json({
          success: false,
          message: "Could not verify administrator access.",
        });
      }
    });
  }

  // List businesses by status.
  app.get(
    "/api/admin/businesses",
    requirePlatformAdmin,
    async (req, res) => {
      try {
        const allowedStatuses = [
          "pending",
          "active",
          "rejected",
          "suspended",
        ];

        const status =
          typeof req.query.status === "string"
            ? req.query.status
            : "pending";

        if (!allowedStatuses.includes(status)) {
          return res.status(400).json({
            success: false,
            message: "Invalid business status.",
          });
        }

        const list = await businesses
          .aggregate([
            { $match: { status } },
            {
              $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "businessId",
                as: "owners",
              },
            },
            {
              $project: {
                name: 1,
                status: 1,
                createdAt: 1,
                approvalRequestedAt: 1,
                approvedAt: 1,
                rejectedAt: 1,
                owners: {
                  $map: {
                    input: "$owners",
                    as: "owner",
                    in: {
                      name: "$$owner.name",
                      email: "$$owner.email",
                      role: "$$owner.role",
                    },
                  },
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 200 },
          ])
          .toArray();

        return res.json({
          success: true,
          businesses: list,
        });
      } catch (error) {
        console.error("Admin business list error:", error.message);

        return res.status(500).json({
          success: false,
          message: "Could not load business accounts.",
        });
      }
    }
  );


  // Edit business details. Only platform admins can use this route.
  app.patch(
    "/api/admin/businesses/:id",
    requirePlatformAdmin,
    async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({
            success: false,
            message: "Invalid business ID.",
          });
        }

        const businessId = new ObjectId(id);
        const body = req.body || {};

        const name =
          typeof body.name === "string" ? body.name.trim() : "";

        const ownerName =
          typeof body.ownerName === "string"
            ? body.ownerName.trim()
            : "";

        const email =
          typeof body.email === "string"
            ? body.email.trim().toLowerCase()
            : "";

        const phone =
          typeof body.phone === "string" ? body.phone.trim() : "";

        if (!name || name.length > 150) {
          return res.status(400).json({
            success: false,
            message: "Business name is required and must be under 150 characters.",
          });
        }

        if (!ownerName || ownerName.length > 100) {
          return res.status(400).json({
            success: false,
            message: "Owner name is required and must be under 100 characters.",
          });
        }

        if (
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
          email.length > 150
        ) {
          return res.status(400).json({
            success: false,
            message: "Enter a valid owner email address.",
          });
        }

        if (phone.length > 20 || (phone && !/^[+\d()\s-]{7,20}$/.test(phone))) {
          return res.status(400).json({
            success: false,
            message: "Enter a valid phone number.",
          });
        }

        const business = await businesses.findOne({
          _id: businessId,
        });

        if (!business) {
          return res.status(404).json({
            success: false,
            message: "Business not found.",
          });
        }

        // Find the business owner without modifying platform admins.
        const owner = await users.findOne({
          businessId,
          role: "owner",
        });

        if (!owner) {
          return res.status(404).json({
            success: false,
            message: "Business owner account not found.",
          });
        }

        // Do not allow the email to be used by another account.
        const duplicateEmail = await users.findOne({
          email,
          _id: { $ne: owner._id },
        });

        if (duplicateEmail) {
          return res.status(409).json({
            success: false,
            message: "This email address is already used by another account.",
          });
        }

        const now = new Date();

        await businesses.updateOne(
          { _id: businessId },
          {
            $set: {
              name,
              phone,
              updatedAt: now,
            },
          }
        );

        await users.updateOne(
          { _id: owner._id },
          {
            $set: {
              name: ownerName,
              email,
              updatedAt: now,
            },
          }
        );

        return res.json({
          success: true,
          message: "Business details updated successfully.",
        });
      } catch (error) {
        if (error.code === 11000) {
          return res.status(409).json({
            success: false,
            message: "This email address is already used by another account.",
          });
        }

        console.error("Edit business error:", error.message);

        return res.status(500).json({
          success: false,
          message: "Could not update business details.",
        });
      }
    }
  );


  // Approve a pending business.
  app.patch(
    "/api/admin/businesses/:id/approve",
    requirePlatformAdmin,
    async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({
            success: false,
            message: "Invalid business ID.",
          });
        }

        const now = new Date();

        const result = await businesses.updateOne(
          {
            _id: new ObjectId(id),
            status: "pending",
          },
          {
            $set: {
              status: "active",
              approvedAt: now,
              approvedBy: new ObjectId(req.auth.userId),
              updatedAt: now,
            },
          }
        );

        if (!result.modifiedCount) {
          return res.status(409).json({
            success: false,
            message:
              "Business was not found or is no longer pending.",
          });
        }

        return res.json({
          success: true,
          message: "Business approved successfully.",
        });
      } catch (error) {
        console.error("Business approval error:", error.message);

        return res.status(500).json({
          success: false,
          message: "Could not approve the business.",
        });
      }
    }
  );

  // Reject a pending business.
  app.patch(
    "/api/admin/businesses/:id/reject",
    requirePlatformAdmin,
    async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({
            success: false,
            message: "Invalid business ID.",
          });
        }

        const reason =
          typeof req.body?.reason === "string"
            ? req.body.reason.trim().slice(0, 500)
            : "";

        const now = new Date();

        const result = await businesses.updateOne(
          {
            _id: new ObjectId(id),
            status: "pending",
          },
          {
            $set: {
              status: "rejected",
              rejectionReason: reason,
              rejectedAt: now,
              rejectedBy: new ObjectId(req.auth.userId),
              updatedAt: now,
            },
          }
        );

        if (!result.modifiedCount) {
          return res.status(409).json({
            success: false,
            message:
              "Business was not found or is no longer pending.",
          });
        }

        return res.json({
          success: true,
          message: "Business registration rejected.",
        });
      } catch (error) {
        console.error("Business rejection error:", error.message);

        return res.status(500).json({
          success: false,
          message: "Could not reject the business.",
        });
      }
    }
  );
}

module.exports = { registerAdminRoutes };
