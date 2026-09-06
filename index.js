require('dotenv').config();

const app = require('./src/app');
const { validateStartup } = require('./src/db/startup-validation');

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await validateStartup();
  } catch (error) {
    console.error(`Startup validation failed: ${error.message}`);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

start();
