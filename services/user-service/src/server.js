require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");

const port = process.env.PORT || 5001;

async function start() {
  await connectDB();
  app.listen(port, () => {
    console.log(`User service running on ${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start user service", error);
  process.exit(1);
});
