const express=require('express');
const router=express.Router();
const adminController=require('../controller/adminController/adminController');
const customerController=require('../controller/adminController/customerController');
const productController=require('../controller/adminController/productController');
const categoryController=require('../controller/adminController/categoryController');
const {checkSession}=require('../middleware/adminAuth');
const upload=require('../middleware/upload');

router.get('/login',adminController.loadlogin);
router.post('/login',adminController.login);
router.get('/logout',adminController.logout);
router.get('/dashboard',checkSession,adminController.loadDashboard);

router.get('/customer',checkSession,customerController.loadCustomer);

router.get("/category", checkSession, categoryController.loadCategory)
router.get("/addCategory", checkSession, categoryController.loadAddCategory)
router.post("/addCategory", checkSession, categoryController.addCategory)
router.get("/editCategory", checkSession, categoryController.loadEditCategory)
router.post("/editCategory/:id", checkSession, categoryController.editCategory)
router.delete("/deleteCategory/:id", checkSession, categoryController.deleteCategory)
router.post("/toggleCategoryListing/:id", checkSession, categoryController.toggleCategoryListing)

router.get('/products',checkSession,productController.loadProducts);
router.get('/addProduct',checkSession,productController.loadAddProduct);
router.post('/addProduct',checkSession,upload.fields([
    { name: 'mainImage', maxCount: 1 },
    { name: 'additionalImage1', maxCount: 1 },
    { name: 'additionalImage2', maxCount: 1 }]), productController.addProduct);
router.get('/editProduct', checkSession, productController.loadEditProduct);
router.post('/editProduct', checkSession, upload.fields([
      { name: 'mainImage', maxCount: 1 },
      { name: 'additionalImage1', maxCount: 1 },
      { name: 'additionalImage2', maxCount: 1 }]), productController.editProduct);
router.delete("/deleteProduct/:id", checkSession, productController.deleteProduct);
router.put("/toggleProductListing/:id", checkSession, productController.toggleProductListing);
      
    

module.exports=router;