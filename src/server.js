require('dotenv').config();

const createApp = require('./app');

const port = Number(process.env.PORT) || 5000;

if (!process.env.JWT_SECRET) {
  // eslint-disable-next-line no-console
  console.warn('WARNING: JWT_SECRET is not set. Set it in .env before production use.');
}

const app = createApp();

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Woodcastle API listening on http://localhost:${port}`);
});
