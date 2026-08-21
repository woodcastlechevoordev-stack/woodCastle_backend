const express = require('express');
const controller = require('./reviews.controller');
const adminAuth = require('../../middleware/adminAuth');

const publicRouter = express.Router();
const googleReviewsRouter = express.Router();
const adminRouter = express.Router();

publicRouter.get('/', controller.list);
googleReviewsRouter.get('/', controller.listGoogle);

adminRouter.get('/', adminAuth, controller.adminList);
adminRouter.post('/', adminAuth, controller.create);
adminRouter.patch('/:id', adminAuth, controller.update);
adminRouter.delete('/:id', adminAuth, controller.remove);

module.exports = { publicRouter, googleReviewsRouter, adminRouter };
