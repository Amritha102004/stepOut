const express=require('express');
const router=express.Router();
const adminController=require('../controller/adminController/adminController');
const customerController=require('../controller/adminController/customerController');
const productController=require('../controller/adminController/productController');
const categoryController=require('../controller/adminController/categoryController');
const {checkSession}=require('../middleware/adminAuth');
const {isAdmin}=require('../middleware/adminAuth');
const upload=require('../middleware/upload');

router.get('/login',adminController.loadlogin);
router.post('/login',adminController.login);
router.get('/logout',adminController.logout);
router.get('/dashboard',checkSession,adminController.loadDashboard);

router.get('/customer',checkSession,customerController.loadCustomer);
router.patch('/toggleUserStatus/:id',checkSession, isAdmin, customerController.block)


router.get("/category", checkSession, categoryController.loadCategory)
router.get("/addCategory", checkSession, isAdmin, categoryController.loadAddCategory)
router.post("/addCategory", checkSession, isAdmin, categoryController.addCategory)
router.get("/editCategory", checkSession, isAdmin, categoryController.loadEditCategory)
router.post("/editCategory/:id", checkSession, isAdmin, categoryController.editCategory)
router.delete("/deleteCategory/:id", checkSession, isAdmin, categoryController.deleteCategory)
router.post("/toggleCategoryListing/:id", checkSession, isAdmin, categoryController.toggleCategoryListing)

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
      
    

module.exports=router;