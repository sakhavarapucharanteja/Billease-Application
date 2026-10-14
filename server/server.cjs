require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const { registerAuthRoutes } = require("./auth-routes.cjs");
const { authenticateToken } = require("./auth.cjs");
const { registerAdminRoutes } = require("./admin-routes.cjs");
const app = express();
const PORT = Number(process.env.PORT) || 5000;
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
const DATABASE_NAME = process.env.DATABASE_NAME || "billease_db";
const client = new MongoClient(MONGO_URI);
const allowedOrigins = (
  process.env.FRONTEND_URL || "http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(
  cors({
    origin(origin, callback) {
      // Allow requests without an Origin header, such as local health checks.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origin not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "1mb" }));
let db;
const productsCollection = () => db.collection("products");
const salesCollection = () => db.collection("sales");
const customersCollection = () => db.collection("customers");
const settingsCollection = () => db.collection("settings");
// Always derive businessId from the verified authentication token.
function getBusinessId(req, res) {
  const value = req.auth?.businessId;
  if (!ObjectId.isValid(value)) {
    res.status(401).json({
      success: false,
      message: "Invalid business session.",
    });
    return null;
  }
  return new ObjectId(value);
}



async function requireApprovedBusiness(req, res, next) {
  authenticateToken(req, res, async () => {
    try {
      if (!req.auth?.businessId || !ObjectId.isValid(req.auth.businessId)) {
        return res.status(401).json({
          success: false,
          code: "INVALID_SESSION",
          message: "Your session is invalid. Please log in again.",
        });
      }

      const business = await db.collection("businesses").findOne({
        _id: new ObjectId(req.auth.businessId),
      });

      if (!business) {
        return res.status(403).json({
          success: false,
          code: "BUSINESS_NOT_FOUND",
          message: "Your business account could not be found.",
        });
      }

      if (business.status !== "active") {
        const isPending = business.status === "pending";

        return res.status(403).json({
          success: false,
          code: isPending ? "BUSINESS_PENDING" : "BUSINESS_INACTIVE",
          status: business.status,
          message: isPending
            ? "Your company registration is awaiting admin approval."
            : "Your company does not currently have access. Contact BillEase support.",
        });
      }

      if (!ObjectId.isValid(req.auth.userId)) {
        return res.status(401).json({
          success: false,
          message: "Invalid user session.",
        });
      }

      const user = await db.collection("users").findOne({
        _id: new ObjectId(req.auth.userId),
        businessId: business._id,
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User account not found.",
        });
      }

      req.business = business;
      req.user = user;
      return next();
    } catch (error) {
      console.error("Business approval check failed:", error.message);

      return res.status(500).json({
        success: false,
        message: "Could not verify your business approval. Please try again.",
      });
    }
  });
}

// =====================================================
// PUBLIC ROUTES
// =====================================================
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "BillEase backend is running!",
  });
});
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    service: "BillEase API",
    database: db ? "connected" : "disconnected",
  });
});

// =====================================================
// STORE SETTINGS API
// =====================================================
const DEFAULT_STORE_SETTINGS = {
  businessName: "My Store",
  phone: "",
  email: "",
  address: "",
  gstin: "",
  logo: "",
};
app.get("/api/settings", requireApprovedBusiness, async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;
    // Load only the authenticated business and its owner.
    const [business, savedSettings, owner] = await Promise.all([
      db.collection("businesses").findOne({
        _id: businessId,
        status: "active",
      }),
      settingsCollection().findOne({ businessId }),
      db.collection("users").findOne({
        businessId,
        role: "owner",
      }),
    ]);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business account not found or inactive.",
      });
    }
    // Use registration details when settings have not been customized.
    const savedBusinessName =
      typeof savedSettings?.businessName === "string"
        ? savedSettings.businessName.trim()
        : "";
    const settings = {
      businessName:
        savedBusinessName && savedBusinessName !== "My Store"
          ? savedBusinessName
          : business.name || "My Store",
      phone: savedSettings?.phone || "",
      email: savedSettings?.email || owner?.email || "",
      address: savedSettings?.address || "",
      gstin: savedSettings?.gstin || "",
      logo: savedSettings?.logo || "",
    };
    return res.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error("Failed to fetch settings:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not fetch store settings.",
    });
  }
});
app.put("/api/settings", requireApprovedBusiness, async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;
    const body = req.body || {};
    const businessName =
      typeof body.businessName === "string"
        ? body.businessName.trim()
        : "";
    const phone =
      typeof body.phone === "string" ? body.phone.trim() : "";
    const email =
      typeof body.email === "string" ? body.email.trim() : "";
    const address =
      typeof body.address === "string" ? body.address.trim() : "";
    const gstin =
      typeof body.gstin === "string"
        ? body.gstin.trim().toUpperCase()
        : "";
    const logo = typeof body.logo === "string" ? body.logo : "";
    if (!businessName || businessName.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Enter a business name up to 100 characters.",
      });
    }
    if (
      phone.length > 20 ||
      (phone && !/^[+\d()\s-]{7,20}$/.test(phone))
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid business phone number.",
      });
    }
    if (
      email.length > 120 ||
      (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid business email address.",
      });
    }
    if (address.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Address cannot exceed 500 characters.",
      });
    }
    if (
      gstin &&
      !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid 15-character GSTIN, or leave it blank.",
      });
    }
    if (
      logo &&
      (!logo.startsWith("data:image/") ||
        logo.length > 8 * 1024 * 1024)
    ) {
      return res.status(400).json({
        success: false,
        message: "Logo must be an image smaller than approximately 6 MB.",
      });
    }
    const settings = {
      businessName,
      phone,
      email,
      address,
      gstin,
      logo,
      updatedAt: new Date(),
    };
    await settingsCollection().updateOne(
      { businessId },
      {
        $set: settings,
        $setOnInsert: {
          _id: `store-settings-${businessId.toString()}`,
          businessId,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );
    res.json({
      success: true,
      message: "Store settings saved successfully.",
      settings,
    });
  } catch (error) {
    console.error("Failed to save settings:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not save store settings.",
    });
  }
});
// =====================================================
// SALES API
// =====================================================
// Get invoices for the logged-in business.
app.get("/api/sales", requireApprovedBusiness, async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 500)
      : 500;
    const sales = await salesCollection()
      .find({ businessId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .toArray();
    res.json({
      success: true,
      sales,
    });
  } catch (error) {
    console.error("Failed to fetch sales:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not fetch sales.",
    });
  }
});
// Get one invoice belonging to the logged-in business.
app.get("/api/sales/:id", requireApprovedBusiness, async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;
    const sale = await salesCollection().findOne({
      businessId,
      id: req.params.id,
    });
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found.",
      });
    }
    res.json({
      success: true,
      sale,
    });
  } catch (error) {
    console.error("Failed to fetch invoice:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not fetch invoice.",
    });
  }
});
// Save an invoice.
app.post("/api/sales", requireApprovedBusiness, async (req, res) => {
  const businessId = getBusinessId(req, res);
  if (!businessId) return;

  const decremented = [];
  let saleInserted = false;

  try {
    const body = req.body || {};
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const customer = typeof body.customer === "string" ? body.customer.trim() : "";
    const mobile = typeof body.mobile === "string" ? body.mobile.trim() : "";
    const payment = typeof body.payment === "string" ? body.payment.trim() : "";
    const items = Array.isArray(body.items) ? body.items : null;
    const discountPercent = Number(body.discountPercent ?? 0);

    if (!id || id.length > 80) return res.status(400).json({ success: false, message: "A valid invoice ID is required." });
    if (!customer || customer.length > 100) return res.status(400).json({ success: false, message: "A valid customer name is required." });
    if (!/^[6-9]\d{9}$/.test(mobile)) return res.status(400).json({ success: false, message: "A valid 10-digit Indian mobile number is required." });
    if (!["Cash", "UPI", "Card"].includes(payment)) return res.status(400).json({ success: false, message: "A valid payment method is required." });
    if (!items || items.length < 1 || items.length > 200) return res.status(400).json({ success: false, message: "At least one valid invoice item is required." });
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) return res.status(400).json({ success: false, message: "Discount must be between 0 and 100 percent." });

    const existing = await salesCollection().findOne({ businessId, id });
    if (existing) return res.status(409).json({ success: false, message: "This invoice has already been saved. Refresh sales history before trying again.", sale: existing });

    const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
    const safeItems = [];
    const quantities = new Map();
    let subtotalRaw = 0;

    for (const item of items) {
      const productId = Number(item?.id);
      const qty = Number(item?.qty);
      const requestedGst = Number(item?.gst ?? 0);
      if (!Number.isSafeInteger(productId) || productId < 1 || !Number.isSafeInteger(qty) || qty < 1 || !Number.isFinite(requestedGst) || requestedGst < 0 || requestedGst > 100) {
        return res.status(400).json({ success: false, message: "One or more invoice items are invalid." });
      }

      const ownedProduct = await productsCollection().findOne({ businessId, id: productId });
      if (!ownedProduct) return res.status(400).json({ success: false, message: `Product ${productId} does not belong to this business.` });
      const databasePrice = Number(ownedProduct.price);
      const productGst = Number(ownedProduct.gst ?? 0);
      const allowedOverrideRates = [0, 5, 12, 18, 28];
      if (!Number.isFinite(databasePrice) || databasePrice < 0) return res.status(400).json({ success: false, message: `The saved price for "${ownedProduct.name}" is invalid. Update the product before billing.` });
      if (Math.abs(requestedGst - productGst) >= 0.000001 && !allowedOverrideRates.includes(requestedGst)) return res.status(400).json({ success: false, message: `GST rate for "${ownedProduct.name}" is not allowed.` });

      subtotalRaw += databasePrice * qty;
      quantities.set(productId, (quantities.get(productId) || 0) + qty);
      safeItems.push({ id: productId, name: String(ownedProduct.name || "").slice(0, 200), sku: String(ownedProduct.sku || ""), qty, price: databasePrice, gst: requestedGst });
    }

    const subtotal = roundMoney(subtotalRaw);
    const discountAmount = roundMoney(subtotalRaw * discountPercent / 100);
    const taxRaw = safeItems.reduce((sum, item) => {
      const lineGross = item.price * item.qty;
      const lineDiscount = subtotalRaw > 0 ? (discountAmount * lineGross) / subtotalRaw : 0;
      return sum + (lineGross - lineDiscount) * item.gst / 100;
    }, 0);
    const tax = roundMoney(taxRaw);
    const total = roundMoney(subtotal - discountAmount + tax);

    // Atomically reserve stock per product. If any item fails, restore earlier decrements.
    for (const [productId, qty] of quantities.entries()) {
      const result = await productsCollection().updateOne(
        { businessId, id: productId, stock: { $gte: qty } },
        { $inc: { stock: -qty } }
      );
      if (!result.modifiedCount) {
        const product = await productsCollection().findOne({ businessId, id: productId });
        throw new Error(!product ? `A product in this invoice no longer exists.` : `Insufficient stock for "${product.name}". Refresh products and try again.`);
      }
      decremented.push({ productId, qty });
    }

    const createdAt = new Date();
    const sale = {
      businessId, id,
      date: typeof body.date === "string" && body.date.length <= 100 ? body.date : createdAt.toLocaleString("en-IN"),
      createdAt, customer, mobile, items: safeItems, subtotal, discountPercent,
      discountAmount, tax, total, payment, createdAtServer: new Date(),
    };
    await salesCollection().insertOne(sale);
    saleInserted = true;
    return res.status(201).json({ success: true, message: "Sale saved successfully.", sale });
  } catch (error) {
    // Compensation protects against ordinary request failures on standalone MongoDB.
    // A process/power failure between operations still requires replica-set transactions for full atomicity.
    if (!saleInserted && decremented.length) {
      for (const entry of [...decremented].reverse()) {
        try {
          await productsCollection().updateOne(
            { businessId, id: entry.productId },
            { $inc: { stock: entry.qty } }
          );
        } catch (rollbackError) {
          console.error("CRITICAL: stock rollback failed:", rollbackError.message, entry);
        }
      }
    }
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "This invoice ID already exists. Refresh sales history before trying again." });
    if (error.message && (error.message.startsWith("Insufficient stock") || error.message.includes("no longer exists"))) {
      return res.status(409).json({ success: false, message: error.message });
    }
    console.error("Failed to save sale:", error.message);
    return res.status(500).json({ success: false, message: "Could not save sale. Please refresh sales and products before retrying." });
  }
});

// =====================================================
// PRODUCTS API
// =====================================================
// Get products.
app.get("/api/products", requireApprovedBusiness, async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;
    const products = await productsCollection()
      .find({ businessId })
      .sort({ id: 1 })
      .toArray();
    res.json({
      success: true,
      products,
    });
  } catch (error) {
    console.error("Failed to fetch products:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not fetch products.",
    });
  }
});
// Add product.
app.post("/api/products", requireApprovedBusiness, async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;
    const body = req.body || {};
    const { name, sku, category, price, gst, stock } = body;
    const purchasePrice = Number(body.purchasePrice ?? price);
    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof sku !== "string" ||
      !sku.trim() ||
      typeof category !== "string" ||
      !category.trim() ||
      !Number.isFinite(Number(price)) ||
      Number(price) < 0 ||
      !Number.isFinite(purchasePrice) ||
      purchasePrice < 0 ||
      !Number.isFinite(Number(gst)) ||
      Number(gst) < 0 ||
      Number(gst) > 100 ||
      !Number.isInteger(Number(stock)) ||
      Number(stock) < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter valid product details.",
      });
    }
    const products = productsCollection();
    const normalizedSku = sku.trim().toUpperCase();
    const duplicate = await products.findOne({
      businessId,
      sku: normalizedSku,
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "A product with this SKU already exists.",
      });
    }
    const lastProduct = await products
      .find({ businessId })
      .sort({ id: -1 })
      .limit(1)
      .toArray();
    const product = {
      businessId,
      id: (lastProduct[0]?.id || 0) + 1,
      name: name.trim(),
      sku: normalizedSku,
      category: category.trim(),
      purchasePrice,
      price: Number(price),
      gst: Number(gst),
      stock: Number(stock),
      color:
        typeof body.color === "string" ? body.color : "#e0e7ff",
      symbol:
        typeof body.symbol === "string" ? body.symbol : "📦",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await products.insertOne(product);
    res.status(201).json({
      success: true,
      message: "Product added successfully.",
      product,
    });
  } catch (error) {
    console.error("Failed to add product:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not add product.",
    });
  }
});
// Update product.
app.put("/api/products/:id", requireApprovedBusiness, async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }
    const body = req.body || {};
    const { name, sku, category, price, gst, stock } = body;
    const purchasePrice = Number(body.purchasePrice ?? price);
    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof sku !== "string" ||
      !sku.trim() ||
      typeof category !== "string" ||
      !category.trim() ||
      !Number.isFinite(Number(price)) ||
      Number(price) < 0 ||
      !Number.isFinite(purchasePrice) ||
      purchasePrice < 0 ||
      !Number.isFinite(Number(gst)) ||
      Number(gst) < 0 ||
      Number(gst) > 100 ||
      !Number.isInteger(Number(stock)) ||
      Number(stock) < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter valid product details.",
      });
    }
    const products = productsCollection();
    const normalizedSku = sku.trim().toUpperCase();
    const duplicate = await products.findOne({
      businessId,
      sku: normalizedSku,
      id: { $ne: id },
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "Another product already uses this SKU.",
      });
    }
    const updatedProduct = {
      name: name.trim(),
      sku: normalizedSku,
      category: category.trim(),
      purchasePrice,
      price: Number(price),
      gst: Number(gst),
      stock: Number(stock),
      color:
        typeof body.color === "string" ? body.color : "#e0e7ff",
      symbol:
        typeof body.symbol === "string" ? body.symbol : "📦",
      updatedAt: new Date(),
    };
    const result = await products.updateOne(
      { businessId, id },
      { $set: updatedProduct }
    );
    if (!result.matchedCount) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }
    const product = await products.findOne({
      businessId,
      id,
    });
    res.json({
      success: true,
      message: "Product updated successfully.",
      product,
    });
  } catch (error) {
    console.error("Failed to update product:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not update product.",
    });
  }
});
// Delete product.
app.delete("/api/products/:id", requireApprovedBusiness, async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }
    const result = await productsCollection().deleteOne({
      businessId,
      id,
    });
    if (!result.deletedCount) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }
    res.json({
      success: true,
      message: "Product deleted successfully.",
    });
  } catch (error) {
    console.error("Failed to delete product:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not delete product.",
    });
  }
});
// =====================================================
// CUSTOMERS API
// =====================================================
// Get customers.
app.get("/api/customers", requireApprovedBusiness, async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;
    const customers = await customersCollection()
      .find({ businessId })
      .sort({ createdAt: -1 })
      .toArray();
    res.json({
      success: true,
      customers,
    });
  } catch (error) {
    console.error("Failed to fetch customers:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not fetch customers.",
    });
  }
});
// Add customer or reuse an existing customer with the same mobile.
app.post("/api/customers", requireApprovedBusiness, async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;
    const body = req.body || {};
    const { name, mobile, email = "", address = "" } = body;
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a customer name (maximum 100 characters).",
      });
    }
    const cleanMobile =
      typeof mobile === "string" ? mobile.trim() : "";
    const cleanEmail =
      typeof email === "string" ? email.trim() : "";
    const cleanAddress =
      typeof address === "string" ? address.trim() : "";
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid 10-digit Indian mobile number.",
      });
    }
    if (
      cleanEmail.length > 150 ||
      (cleanEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address.",
      });
    }
    if (cleanAddress.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Address cannot exceed 500 characters.",
      });
    }
    const collection = customersCollection();
    const existing = await collection.findOne({
      businessId,
      mobile: cleanMobile,
    });
    if (existing) {
      return res.status(200).json({
        success: true,
        existing: true,
        message: "Existing customer found. Reusing customer record.",
        customer: existing,
      });
    }
    const lastCustomer = await collection
      .find({ businessId })
      .sort({ id: -1 })
      .limit(1)
      .toArray();
    const customer = {
      businessId,
      id: (lastCustomer[0]?.id || 0) + 1,
      name: name.trim(),
      mobile: cleanMobile,
      email: cleanEmail,
      address: cleanAddress,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await collection.insertOne(customer);
    res.status(201).json({
      success: true,
      existing: false,
      message: "Customer added successfully.",
      customer,
    });
  } catch (error) {
    console.error("Failed to add customer:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not add customer.",
    });
  }
});
// Update customer.
app.put("/api/customers/:id", requireApprovedBusiness, async (req, res) => {
  try {
    const businessId = getBusinessId(req, res);
    if (!businessId) return;
    const id = Number(req.params.id);
    const body = req.body || {};
    const { name, mobile, email = "", address = "" } = body;
    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID.",
      });
    }
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid customer name.",
      });
    }
    const cleanMobile =
      typeof mobile === "string" ? mobile.trim() : "";
    const cleanEmail =
      typeof email === "string" ? email.trim() : "";
    const cleanAddress =
      typeof address === "string" ? address.trim() : "";
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid 10-digit Indian mobile number.",
      });
    }
    if (
      cleanEmail.length > 150 ||
      (cleanEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address.",
      });
    }
    if (cleanAddress.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Address cannot exceed 500 characters.",
      });
    }
    const collection = customersCollection();
    const duplicate = await collection.findOne({
      businessId,
      mobile: cleanMobile,
      id: { $ne: id },
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "Another customer already uses this mobile number.",
      });
    }
    const result = await collection.updateOne(
      { businessId, id },
      {
        $set: {
          name: name.trim(),
          mobile: cleanMobile,
          email: cleanEmail,
          address: cleanAddress,
          updatedAt: new Date(),
        },
      }
    );
    if (!result.matchedCount) {
      return res.status(404).json({
        success: false,
        message: "Customer not found.",
      });
    }
    const customer = await collection.findOne({
      businessId,
      id,
    });
    res.json({
      success: true,
      message: "Customer updated successfully.",
      customer,
    });
  } catch (error) {
    console.error("Failed to update customer:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not update customer.",
    });
  }
});
// Delete customer.
app.delete(
  "/api/customers/:id",
  requireApprovedBusiness,
  async (req, res) => {
    try {
      const businessId = getBusinessId(req, res);
      if (!businessId) return;
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({
          success: false,
          message: "Invalid customer ID.",
        });
      }
      const result = await customersCollection().deleteOne({
        businessId,
        id,
      });
      if (!result.deletedCount) {
        return res.status(404).json({
          success: false,
          message: "Customer not found.",
        });
      }
      res.json({
        success: true,
        message: "Customer deleted successfully.",
      });
    } catch (error) {
      console.error("Failed to delete customer:", error.message);
      res.status(500).json({
        success: false,
        message: "Could not delete customer.",
      });
    }
  }
);
// =====================================================
// START SERVER
// =====================================================
async function startServer() {
  try {
    await client.connect();
    db = client.db(DATABASE_NAME);
    console.log("Connected to MongoDB successfully!");
    console.log(`Database: ${DATABASE_NAME}`);

    await salesCollection().createIndex(
      { businessId: 1, id: 1 },
      { unique: true, name: "unique_business_invoice_id" }
    );
    console.log("Unique invoice index is ready.");
    const { ensureAuthIndexes } = registerAuthRoutes(app, db);
    await ensureAuthIndexes();

    registerAdminRoutes(app, db);
    console.log("Admin approval routes are ready.");
    
    console.log("Authentication indexes are ready.");
    app.listen(PORT, () => {
      console.log(
        `BillEase backend running at http://localhost:${PORT}`
      );
    });
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error.message);
    process.exit(1);
  }
}
startServer();
