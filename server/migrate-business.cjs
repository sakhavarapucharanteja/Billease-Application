
const { MongoClient, ObjectId } = require("mongodb");

const MONGO_URI = "mongodb://127.0.0.1:27017";
const DATABASE_NAME = "billease_db";
const BUSINESS_ID = "6acdbe96f35211baf35604c7";

async function migrateBusinessData() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();

    const db = client.db(DATABASE_NAME);
    const businessId = new ObjectId(BUSINESS_ID);

    const business = await db.collection("businesses").findOne({
      _id: businessId,
      status: "active",
    });

    if (!business) {
      throw new Error(
        "BillEase Admin business not found or inactive. No migration performed."
      );
    }

    const collections = ["products", "customers", "sales", "settings"];

    for (const name of collections) {
      const result = await db.collection(name).updateMany(
        { businessId: { $exists: false } },
        { $set: { businessId } }
      );

      console.log(`${name}: assigned ${result.modifiedCount} records`);
    }

    console.log("Migration completed.");
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

migrateBusinessData();
