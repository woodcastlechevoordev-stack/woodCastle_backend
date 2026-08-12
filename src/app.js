const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { notFound, errorHandler } = require('./middleware/errorHandler');

const adminAuthRoutes = require('./modules/admin/admin.routes');
const { publicRouter: categoriesPublic, adminRouter: categoriesAdmin } = require('./modules/categories/categories.routes');
const { publicRouter: productsPublic, adminRouter: productsAdmin } = require('./modules/products/products.routes');
const { publicRouter: pagesPublic, adminRouter: pagesAdmin } = require('./modules/pages/pages.routes');
const { publicRouter: blogPublic, adminRouter: blogAdmin } = require('./modules/blog/blog.routes');
const { publicRouter: offersPublic, adminRouter: offersAdmin } = require('./modules/offers/offers.routes');
const { publicRouter: enquiriesPublic, adminRouter: enquiriesAdmin } = require('./modules/enquiries/enquiries.routes');
const { adminRouter: importAdmin } = require('./modules/bulk-import/bulk-import.routes');
const { adminRouter: uploadAdmin } = require('./modules/upload/upload.routes');

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'woodcastle-backend' });
  });

  // Public
  app.use('/api/categories', categoriesPublic);
  app.use('/api/products', productsPublic);
  app.use('/api/pages', pagesPublic);
  app.use('/api/blog', blogPublic);
  app.use('/api/offers', offersPublic);
  app.use('/api/enquiries', enquiriesPublic);

  // Admin auth (login + 2FA)
  app.use('/api/admin', adminAuthRoutes);

  // Admin resources
  app.use('/api/admin/categories', categoriesAdmin);
  app.use('/api/admin/products', productsAdmin);
  app.use('/api/admin/pages', pagesAdmin);
  app.use('/api/admin/blog', blogAdmin);
  app.use('/api/admin/offers', offersAdmin);
  app.use('/api/admin/enquiries', enquiriesAdmin);
  app.use('/api/admin/import', importAdmin);
  app.use('/api/admin/upload', uploadAdmin);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
