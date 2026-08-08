const express = require('express');
const controller = require('./categories.controller');
const adminAuth = require('../../middleware/adminAuth');

const publicRouter = express.Router();
const adminRouter = express.Router();

publicRouter.get('/', controller.list);
publicRouter.get('/:slug/products', controller.productsBySlug);

adminRouter.get('/', adminAuth, controller.adminList);
adminRouter.post('/', adminAuth, controller.create);
adminRouter.patch('/:id', adminAuth, controller.update);
adminRouter.delete('/:id', adminAuth, controller.remove);

module.exports = { publicRouter, adminRouter };
