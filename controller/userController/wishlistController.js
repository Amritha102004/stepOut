const User = require('../../model/userModel');
const Product = require('../../model/productModel');
const Wishlist = require('../../model/wishlistModel');
const mongoose = require('mongoose');
const statusCode = require("../../utils/httpStatusCodes");


const loadWishlist = async (req, res) => {
    try {
        const user =req.session.user;
        const userId = req.session.user._id;
        const wishlist = await Wishlist.findOne({ user: userId })
            .populate({
                path: 'products',
                match: { isActive: true, isDeleted: false }
            })
            .lean();

        if (!wishlist) {
            return res.render('user/wishlist', { 
                wishlistItems: [],
                user
            });
        }

        const wishlistItems = wishlist.products.filter(product => product !== null);

        res.render('user/wishlist', {
            wishlistItems,
            user
        });
    } catch (error) {
        console.log("Error loading wishlist:", error);
        req.flash("error_msg", "Failed to load wishlist");
        res.status(statusCode.INTERNAL_SERVER_ERROR).redirect('/');
    }
};

const addToWishlist = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { productId } = req.body;

        const product = await Product.findOne({ 
            _id: productId,
            isActive: true,
            isDeleted: false
        });

        if (!product) {
            return res.status(statusCode.NOT_FOUND).json({
                success: false,
                message: "Product not found or unavailable"
            });
        }

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

        if (wishlist.products.includes(productId)) {
            return res.status(statusCode.OK).json({
                success: true,
                message: "Product already in wishlist",
                inWishlist: true
            });
        }
  
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

const removeFromWishlist = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const productId = req.params.productId;
        const wishlist = await Wishlist.findOne({ user: userId });
        
        if (!wishlist) {
            return res.status(statusCode.NOT_FOUND).json({
                success: false,
                message: "Wishlist not found"
            });
        }

        const productIndex = wishlist.products.indexOf(productId);
        // console.log(productIndex);
        if (productIndex === -1) {
            return res.status(statusCode.NOT_FOUND).json({
                success: false,
                message: "Product not found in wishlist"
            });
        }

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

const clearWishlist = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const wishlist = await Wishlist.findOne({ user: userId });
        
        if (!wishlist) {
            return res.status(statusCode.NOT_FOUND).json({
                success: false,
                message: "Wishlist not found"
            });
        }

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

const checkWishlistStatus = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(statusCode.OK).json({
                inWishlist: false
            });
        }

        const userId = req.session.user._id;
        const productId = req.params.productId;
        const wishlist = await Wishlist.findOne({ user: userId });
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