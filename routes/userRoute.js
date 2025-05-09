const express=require('express');
const router=express.Router();
const userController=require('../controller/userController/userController');
const productController=require('../controller/userController/productController')
const passport=require('passport');
const {isLogin}=require('../middleware/userAuth')
const {isBlocked}=require('../middleware/userAuth')
const {checkSession}=require('../middleware/userAuth')

router.get('/', isBlocked,userController.loadHome);

router.get('/signup', isLogin, userController.loadSignup)
router.post('/signup', isLogin, userController.signup)
router.post('/otp', isLogin, userController.verifyOtp)  
router.post('/resendotp', isLogin, userController.resendOtp);
router.get('/login', isLogin, userController.loadLogin);
router.post('/login', isLogin, userController.login);
router.get('/forgotpassword', isLogin, userController.loadForgotPassword);
router.post('/forgotpassword', isLogin, userController.handleForgotPassword);
router.get('/resetpassword', isLogin, userController.loadResetPassword);
router.post('/resetpassword', isLogin, userController.changePassword);

router.get('/shop', isBlocked, productController.getAllProducts);
router.get('/product/:id', isBlocked, productController.getProductDetails);

// router.get('/about',userController.logout);
// router.get('/contact',userController.logout);

router.get('/logout',userController.logout);


router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{               /////////////       
    // console.log(req.user);
    req.session.user=req.user;
    res.redirect('/');
})




module.exports=router