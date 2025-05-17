const express=require('express');
const router=express.Router();
const userController=require('../controller/userController/userController');
const productController=require('../controller/userController/productController');
const accountController=require('../controller/userController/accountController');
const wishlistController=require('../controller/userController/wishlistController');
const cartController=require('../controller/userController/cartController');
const passport=require('passport');
const {isLogin}=require('../middleware/userAuth')
const {isBlocked}=require('../middleware/userAuth')
const {checkSession}=require('../middleware/userAuth')

router.get('/', isBlocked,userController.loadHome);

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

router.get('/account', checkSession, isBlocked,accountController.loadAccount);
router.get('/account/editAccount', checkSession, isBlocked, accountController.loadEditAccount);
router.post('/account/editAccount', checkSession, isBlocked, accountController.editAccount);
router.post('/account/changePassword', checkSession, isBlocked, accountController.changePassword);

router.get('/wishlist', checkSession, isBlocked, wishlistController.loadWishlist);
router.post('/wishlist/add', checkSession, isBlocked, wishlistController.addToWishlist);
router.delete('/wishlist/remove/:productId', checkSession, isBlocked, wishlistController.removeFromWishlist);
router.delete('/wishlist/clear', checkSession, isBlocked, wishlistController.clearWishlist);
router.get('/wishlist/check/:productId', wishlistController.checkWishlistStatus);

router.get('/cart',checkSession,isBlocked, cartController.loadCart)

router.get('/account/orders',(req,res)=>{
    res.render('user/myOrder',{req})
})
router.get('/account/addresses',(req,res)=>{
    res.render('user/address',{req})
})






router.get('/logout',userController.logout);


router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{               /////////////       
    // console.log(req.user);
    req.session.user=req.user;
    res.redirect('/');
})




module.exports=router