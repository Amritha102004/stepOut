const User = require('../../model/userModel');
const Product = require('../../model/productModel');
const Wishlist = require('../../model/wishlistModel');
const mongoose = require('mongoose');
const statusCode = require("../../utils/httpStatusCodes");


const loadWishlist = async (req, res) => {
    try {
        const userId = req.session.user._id;
        
        const populatedWishlist = await Wishlist.findOne({ user: userId })
            .populate({
                path: 'products',
                match: { isActive: true, isDeleted: false }
            })
            .lean();

        if (!populatedWishlist) {
            return res.render('user/wishlist', { 
                wishlistItems: [],
                req
            });
        }

        const wishlistItems = populatedWishlist.products.filter(product => product !== null);

        res.render('user/wishlist', {
            wishlistItems,
            req
        });
    } catch (error) {
        console.log("Error loading wishlist:", error);
        req.flash("error_msg", "Failed to load wishlist");
        res.status(statusCode.INTERNAL_SERVER_ERROR).redirect('/');
    }
};

// Add product to wishlist
const addToWishlist = async (req, res) => {
    try {
        // Since checkSession middleware is applied, we know user is logged in
        const userId = req.session.user._id;
        const { productId } = req.body;

        // Validate product ID
        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(statusCode.BAD_REQUEST).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        // Check if product exists and is active
        const product = await Product.findOne({ 
            _id: productId,
            isActive: true,
            isDeleted: { $ne: true }
        });

        if (!product) {
            return res.status(statusCode.NOT_FOUND).json({
                success: false,
                message: "Product not found or unavailable"
            });
        }

        // Find user's wishlist or create if it doesn't exist
        let wishlist = await Wishlist.findOne({ user: userId });
        
        if (!wishlist) {
            wishlist = new Wishlist({
                user: userId,
                products: [productId]
            });
            await wishlist.save();
            
            return res.status(statusCode.OK).json({
                success: true,
                message: "Product added to wishlist",
                inWishlist: true
            });
        }

        // Check if product is already in wishlist
        if (wishlist.products.includes(productId)) {
            return res.status(statusCode.OK).json({
                success: true,
                message: "Product already in wishlist",
                inWishlist: true
            });
        }

        // Add product to wishlist
        wishlist.products.push(productId);
        await wishlist.save();

        res.status(statusCode.OK).json({
            success: true,
            message: "Product added to wishlist",
            inWishlist: true
        });
    } catch (error) {
        console.log("Error adding to wishlist:", error);
        res.status(statusCode.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Failed to add product to wishlist"
        });
    }
};

// Remove product from wishlist
const removeFromWishlist = async (req, res) => {
    try {
        // Since checkSession middleware is applied, we know user is logged in
        const userId = req.session.user._id;
        const productId = req.params.productId;

        // Validate product ID
        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(statusCode.BAD_REQUEST).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        // Find user's wishlist
        const wishlist = await Wishlist.findOne({ user: userId });
        
        if (!wishlist) {
            return res.status(statusCode.NOT_FOUND).json({
                success: false,
                message: "Wishlist not found"
            });
        }

        // Check if product is in wishlist
        const productIndex = wishlist.products.indexOf(productId);
        if (productIndex === -1) {
            return res.status(statusCode.NOT_FOUND).json({
                success: false,
                message: "Product not found in wishlist"
            });
        }

        // Remove product from wishlist
        wishlist.products.splice(productIndex, 1);
        await wishlist.save();

        res.status(statusCode.OK).json({
            success: true,
            message: "Product removed from wishlist",
            inWishlist: false
        });
    } catch (error) {
        console.log("Error removing from wishlist:", error);
        res.status(statusCode.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Failed to remove product from wishlist"
        });
    }
};

// Clear entire wishlist
const clearWishlist = async (req, res) => {
    try {
        // Since checkSession middleware is applied, we know user is logged in
        const userId = req.session.user._id;

        // Find user's wishlist
        const wishlist = await Wishlist.findOne({ user: userId });
        
        if (!wishlist) {
            return res.status(statusCode.NOT_FOUND).json({
                success: false,
                message: "Wishlist not found"
            });
        }

        // Clear wishlist products
        wishlist.products = [];
        await wishlist.save();

        res.status(statusCode.OK).json({
            success: true,
            message: "Wishlist cleared successfully"
        });
    } catch (error) {
        console.log("Error clearing wishlist:", error);
        res.status(statusCode.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Failed to clear wishlist"
        });
    }
};

// Check if product is in wishlist
const checkWishlistStatus = async (req, res) => {
    try {
        // If user is not logged in, product is not in wishlist
        if (!req.session.user) {
            return res.status(statusCode.OK).json({
                inWishlist: false
            });
        }

        const userId = req.session.user._id;
        const productId = req.params.productId;

        // Validate product ID
        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(statusCode.BAD_REQUEST).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        // Find user's wishlist
        const wishlist = await Wishlist.findOne({ user: userId });
        
        // Check if wishlist exists and product is in it
        const inWishlist = wishlist && wishlist.products.includes(productId);

        res.status(statusCode.OK).json({
            inWishlist
        });
    } catch (error) {
        console.log("Error checking wishlist status:", error);
        res.status(statusCode.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Failed to check wishlist status"
        });
    }
};

module.exports = {
    loadWishlist,
    addToWishlist,
    removeFromWishlist,
    clearWishlist,
    checkWishlistStatus
};