const express=require('express');
const router=express.Router();
const userController=require('../controller/userController/userController');
const passport=require('passport');

router.get('/',userController.loadHome)
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
router.get('/logout',userController.logout);


router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{               /////////////       
    console.log(req.user);
    req.session.user=req.user;
    res.redirect('/');
})



// router.get('/otp',(reg,res)=>{
//     res.render('user/otpVerification')
// })










module.exports=router