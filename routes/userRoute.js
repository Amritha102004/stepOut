const express = require('express');
const router = express.Router();
const userController = require('../controller/userController/userController');
const productController = require('../controller/userController/productController');
const accountController = require('../controller/userController/accountController');
const wishlistController = require('../controller/userController/wishlistController');
const cartController = require('../controller/userController/cartController');
const addressesController = require('../controller/userController/addressesController');
const checkoutController = require('../controller/userController/checkoutController');
const orderController = require('../controller/userController/orderController');
const couponController = require('../controller/userController/couponController');
const walletController = require('../controller/userController/walletController');
const passport = require('passport');
const { isLogin } = require('../middleware/userAuth')
const { isBlocked } = require('../middleware/userAuth')
const { checkSession } = require('../middleware/userAuth')


router.get('/', isBlocked, userController.loadHome);

router.get('/signup', isLogin, userController.loadSignup)
router.post('/signup', isLogin, userController.signup)
router.post('/otp', userController.verifyOtp)
router.post('/resendotp', isLogin, userController.resendOtp);
router.get('/login', isLogin, userController.loadLogin);
router.post('/login', isLogin, userController.login);
router.get('/forgotpassword', isLogin, userController.loadForgotPassword);
router.post('/forgotpassword', isLogin, userController.handleForgotPassword);
router.get('/resetpassword', isLogin, userController.loadResetPassword);
router.post('/resetpassword', isLogin, userController.changePassword);

router.get('/shop', isBlocked, productController.getAllProducts);
router.get('/product/:id', isBlocked, productController.getProductDetails);

// router.get('/about',userController.about);
// router.get('/contact',userController.contact);

router.get('/account', checkSession, isBlocked, accountController.loadAccount);
router.get('/account/editAccount', checkSession, isBlocked, accountController.loadEditAccount);
router.post('/account/editAccount', checkSession, isBlocked, accountController.editAccount);
router.post('/account/changePassword', checkSession, isBlocked, accountController.changePassword);

//address
router.get('/account/addresses', checkSession, isBlocked, addressesController.loadAddresses);
router.post('/account/addresses/add', checkSession, isBlocked, addressesController.addAddress);
router.get('/account/addresses/edit/:addressId', checkSession, isBlocked, addressesController.loadEdit);
router.post('/account/addresses/edit', checkSession, isBlocked, addressesController.editAddress);
router.delete('/account/addresses/delete/:addressId', checkSession, isBlocked, addressesController.deleteAddress);

//wishlist
router.get('/wishlist', checkSession, isBlocked, wishlistController.loadWishlist);
router.post('/wishlist/add', checkSession, isBlocked, wishlistController.addToWishlist);
router.delete('/wishlist/remove/:productId', checkSession, isBlocked, wishlistController.removeFromWishlist);
router.delete('/wishlist/clear', checkSession, isBlocked, wishlistController.clearWishlist);
router.get('/wishlist/check/:productId', wishlistController.checkWishlistStatus);

//cart
router.get('/cart', checkSession, isBlocked, cartController.loadCart);
router.post('/cart/add', checkSession, isBlocked, cartController.addToCart);
router.put('/cart/update', checkSession, isBlocked, cartController.updateCartQuantity);
router.delete('/cart/remove/:productId/:size', checkSession, isBlocked, cartController.removeFromCart);
router.delete('/cart/clear', checkSession, isBlocked, cartController.clearCart);
router.get('/cart/count', cartController.getCartCount);

//checkout,razorpay
router.get('/checkout', checkSession, isBlocked, checkoutController.loadCheckout);
router.post('/checkout/create-razorpay-order', checkSession, isBlocked, checkoutController.createRazorpayOrder)
router.post('/checkout/verify-payment', checkSession, isBlocked, checkoutController.verifyPaymentAndPlaceOrder)
router.post('/checkout/place-order', checkSession, isBlocked, checkoutController.placeOrder);
router.post('/checkout/payment-failure', checkSession, isBlocked, checkoutController.handlePaymentFailure)
router.get('/payment-failure', checkSession, isBlocked, checkoutController.loadPaymentFailure)
router.get('/checkout/retry/:orderId', checkSession, isBlocked, checkoutController.retryPayment)
router.get('/order-success', checkSession, isBlocked, checkoutController.loadOrderSuccess);
router.post("/checkout/create-order-with-wallet", checkSession, checkoutController.createOrderWithWallet)
router.post("/checkout/verify-partial-payment", checkSession, checkoutController.verifyPartialPayment)
router.post("/checkout/validate-coupon", checkSession, checkoutController.validateCoupon)

//coupon
router.post("/checkout/validate-coupon", checkSession, isBlocked, couponController.validateCoupon)
router.get("/checkout/available-coupons", checkSession, isBlocked, couponController.getAvailableCoupons);

//order
router.get('/account/orders', checkSession, isBlocked, orderController.loadOrders);
router.get('/account/orders/:orderId', checkSession, isBlocked, orderController.loadOrderDetail);
router.post('/account/orders/:orderId/cancel', checkSession, isBlocked, orderController.cancelOrder);
router.post('/account/orders/:orderId/return', checkSession, isBlocked, orderController.returnOrder);
router.post('/account/orders/:orderId/cancel-item', checkSession, isBlocked, orderController.cancelOrderItem);
router.post('/account/orders/:orderId/return-item', checkSession, isBlocked, orderController.returnOrderItem);
router.get('/account/orders/:orderId/invoice', checkSession, isBlocked, orderController.downloadInvoice);

//wallet
router.get('/account/wallet', checkSession, isBlocked, walletController.loadWallet)
router.post("/account/wallet/add-money", checkSession, isBlocked, walletController.addMoney)
router.get('/account/wallet/balance', checkSession, isBlocked, walletController.getWalletBalance)
router.get("/account/wallet/transaction/:transactionId",checkSession,isBlocked,walletController.getTransactionDetails,
)

router.get('/logout', userController.logout);

router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/signup' }), (req, res) => {               /////////////       
    // console.log(req.user);
    req.session.user = req.user;
    res.redirect('/');
})


module.exports = router