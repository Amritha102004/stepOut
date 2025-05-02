const express=require('express');
const router=express.Router();
const userController=require('../controller/userController/userController');
const productController=require('../controller/userController/productController')
const passport=require('passport');

router.get('/',userController.loadHome);

router.get('/signup',userController.loadSignup)
router.post('/signup',userController.signup)
router.post('/otp',userController.verifyOtp)  
router.post('/resendotp', userController.resendOtp);
router.get('/login',userController.loadLogin);
router.post('/login',userController.login);
router.get('/forgotpassword',userController.loadForgotPassword);
router.post('/forgotpassword',userController.handleForgotPassword);
router.get('/resetpassword',userController.loadResetPassword);
router.post('/resetpassword',userController.changePassword);

router.get('/shop', productController.getAllProducts);
router.get('/product/:id', productController.getProductDetails);

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