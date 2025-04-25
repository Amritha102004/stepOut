const express=require('express');
const router=express.Router();
const adminController=require('../controller/adminController/adminController');
const customerController=require('../controller/adminController/customerController');


router.get('/login',adminController.loadlogin);
router.post('/login',adminController.login);
router.get('/dashboard',adminController.loadDashboard);
router.get('/logout',adminController.logout);
router.get('/customer',customerController.loadCustomer)


router.get('/customer',(req,res)=>{
    res.render('admin/customer');
})








module.exports=router