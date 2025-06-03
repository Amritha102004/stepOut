const express=require('express');
const router=express.Router();
const adminController=require('../controller/adminController/adminController');
const customerController=require('../controller/adminController/customerController');
const productController=require('../controller/adminController/productController');
const categoryController=require('../controller/adminController/categoryController');
const orderController=require('../controller/adminController/orderController');
const couponController=require('../controller/adminController/couponController');
const walletController=require('../controller/adminController/walletController')
const {checkSession}=require('../middleware/adminAuth');
const {isAdmin}=require('../middleware/adminAuth');
const upload=require('../middleware/upload');

router.get('/login',adminController.loadlogin);
router.post('/login',adminController.login);
router.get('/logout',adminController.logout);
router.get('/dashboard',checkSession,adminController.loadDashboard);

router.get('/customer',checkSession,customerController.loadCustomer);
router.patch('/toggleUserStatus/:id',checkSession, isAdmin, customerController.block)


router.get("/category", checkSession, categoryController.loadCategory);
router.get("/addCategory", checkSession, isAdmin, categoryController.loadAddCategory);
router.post("/addCategory", checkSession, isAdmin, categoryController.addCategory)
router.get("/editCategory", checkSession, isAdmin, categoryController.loadEditCategory)
router.post("/editCategory/:id", checkSession, isAdmin, categoryController.editCategory);
router.delete("/deleteCategory/:id", checkSession, isAdmin, categoryController.deleteCategory)
router.post("/toggleCategoryListing/:id", checkSession, isAdmin, categoryController.toggleCategoryListing);

router.get('/products',checkSession,productController.loadProducts);
router.get('/addProduct',checkSession, isAdmin, productController.loadAddProduct);
router.post('/addProduct',checkSession, isAdmin, upload.fields([
    { name: 'mainImage', maxCount: 1 },
    { name: 'additionalImage1', maxCount: 1 },
    { name: 'additionalImage2', maxCount: 1 }]), productController.addProduct);
router.get('/editProduct', checkSession, isAdmin, productController.loadEditProduct);
router.post('/editProduct', checkSession, isAdmin, upload.fields([
      { name: 'mainImage', maxCount: 1 },
      { name: 'additionalImage1', maxCount: 1 },
      { name: 'additionalImage2', maxCount: 1 }]), productController.editProduct);
router.delete("/deleteProduct/:id", checkSession, isAdmin, productController.deleteProduct);
router.put("/toggleProductListing/:id", checkSession, isAdmin, productController.toggleProductListing);

router.get("/orders", checkSession, orderController.loadOrders);
router.get("/orders/:orderId/details", checkSession, orderController.getOrderDetails)
router.patch("/orders/:orderId/status", checkSession, isAdmin, orderController.updateOrderStatus);
router.post("/orders/:orderId/notify", checkSession, isAdmin, orderController.sendNotification);
router.post("/orders/:orderId/cancel", checkSession, isAdmin, orderController.cancelOrder)
router.delete("/orders/:orderId", checkSession, isAdmin, orderController.deleteOrder)
router.get("/orders/:orderId/invoice", checkSession, orderController.downloadInvoice);
    
router.get("/coupons", checkSession, couponController.loadCoupons);
router.get("/addCoupon", checkSession, isAdmin, couponController.loadAddCoupon);
router.post("/addCoupon", checkSession, isAdmin, couponController.addCoupon)
router.get("/editCoupon", checkSession, isAdmin, couponController.loadEditCoupon);
router.put("/coupons/:id", checkSession, isAdmin, couponController.updateCoupon)
router.patch("/coupons/:id/toggle", checkSession, isAdmin, couponController.toggleCouponStatus)
router.delete("/coupons/:id", checkSession, isAdmin, couponController.deleteCoupon)
router.get("/coupons/:id/details", checkSession, couponController.getCouponDetails)
router.get("/generate-coupon-code", checkSession, couponController.generateCouponCode);
    
router.get("/wallet", checkSession, isAdmin, walletController.loadWalletManagement)
router.get("/wallet/transactions", checkSession, isAdmin, walletController.getWalletTransactions)
router.get("/wallet/user/:userId/details", checkSession, isAdmin, walletController.getUserWalletDetails)
router.post("/wallet/user/:userId/add-money", checkSession, isAdmin, walletController.addMoneyToWallet)
router.post("/wallet/user/:userId/deduct-money", checkSession, isAdmin, walletController.deductMoneyFromWallet)
router.get("/wallet/analytics", checkSession, isAdmin, walletController.getWalletAnalytics)



module.exports=router;