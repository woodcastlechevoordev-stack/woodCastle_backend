const express = require('express');
const controller = require('./pages.controller');
const adminAuth = require('../../middleware/adminAuth');

const publicRouter = express.Router();
const adminRouter = express.Router();

publicRouter.get('/:key', controller.getByKey);

adminRouter.get('/', adminAuth, controller.adminList);
adminRouter.patch('/:key', adminAuth, controller.update);

module.exports = { publicRouter, adminRouter };
