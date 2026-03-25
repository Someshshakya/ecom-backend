const mongoose = require("mongoose");
const logger = require("../utils/logger");

async function connectDB() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI is missing in environment variables");
  }

  mongoose.set("strictQuery", true);

  const conn = await mongoose.connect(mongoUri);
  logger.info(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  return conn;
}

module.exports = connectDB;

