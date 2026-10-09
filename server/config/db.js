const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    console.error("Server will exit. Fix your MONGO_URI or whitelist your IP on Atlas.");
    process.exit(1);
  }
};

module.exports = connectDB;
