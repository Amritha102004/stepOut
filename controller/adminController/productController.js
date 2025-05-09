const Product = require("../../model/productModel");
const Category = require("../../model/categoryModel");
const User = require("../../model/userModel");
const mongoose = require("mongoose");
const upload = require("../../middleware/upload");
const cloudinary = require("cloudinary").v2;
const statusCode = require("../../utils/httpStatusCodes")

const loadProducts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        const searchQuery = req.query.search || "";
        

        let filter = {};
        if (searchQuery) {
            filter.$or = [
                { name: { $regex: searchQuery, $options: "i" } },
                { description: { $regex: searchQuery, $options: "i" } },
            ];
        }
        const totalProducts = await Product.countDocuments({ ...filter, isDeleted: false });
        const totalPages = Math.ceil(totalProducts / limit);

        const products = await Product.find({ ...filter, isDeleted: false })
            .populate("categoryId")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const categories = await Category.find({ isListed: true });

        const admin = req.session.admin
            ? {
                name: req.session.admin.name,
                email: req.session.admin.email,
                // profileImage: req.session.admin.profileImage || "",
            }
            : {};

        res.render("admin/products", {
            admin,
            products,
            categories,
            currentPage: page,
            totalPages,
            totalProducts,
            searchQuery,
            limit,
            query: req.query,
        });
        // }
    } catch (error) {
        console.error(error);
        req.flash("error_msg", "Server error");
        res.status(statusCode.INTERNAL_SERVER_ERROR).render("admin/products", {
            admin: req.session.admin || {},
            products: [],
            categories: [],
            currentPage: 1,
            totalPages: 0,
            totalProducts: 0,
            searchQuery: req.query.search || "",
            query: req.query,
            error_msg: "Server error: " + error.message,
        });
    }
};


const loadAddProduct = async (req, res) => {
    try {
        const categories = await Category.find({ isListed: true });

        const admin = {
            name: req.session.admin.name,
            email: req.session.admin.email,
            // profileImage: req.session.admin.profileImage,
        };

        res.render("admin/addProduct", { admin, categories });
    } catch (error) {
        console.error(error);
        req.flash("error_msg", "Server error");
        res.status(statusCode.INTERNAL_SERVER_ERROR).render("admin/addproduct", {
            admin: req.session.admin || {},
            categories: [],
            error_msg: "Server error",
        });
    }
};

const addProduct = async (req, res) => {
    try {
        const {
            name,
            description,
            categoryId,
            brand,
            color,
            offer,
            sku,
            tags,
        } = req.body;

        const variants = [];
        const sizes = ["6", "7", "8", "9", "10"];

        const varientPrices = Array.isArray(req.body.varientPrice)
            ? req.body.varientPrice
            : [req.body.varientPrice];
        const varientQuantities = Array.isArray(req.body.varientquatity)
            ? req.body.varientquatity
            : [req.body.varientquatity];

        for (let i = 0; i < sizes.length; i++) {
            const price = Number(varientPrices[i]);
            const quantity = Number(varientQuantities[i]);

            if (!isNaN(price) && !isNaN(quantity)) {
                const discount = (price * Number(offer || 0)) / 100;
                const salePrice = price - discount;

                variants.push({
                    size: sizes[i],
                    varientPrice: price,
                    salePrice: Math.round(salePrice),
                    varientquantity: quantity,
                });
            }
        }

        if (variants.length === 0) {
            req.flash("error_msg", "At least one variant is required");
            const categories = await Category.find({ isListed: true });
            return res.render("admin/addProduct", {
                admin: req.session.admin,
                categories,
                error_msg: "At least one variant is required",
            });
        }

        const tagArray = tags ? (Array.isArray(tags) ? tags : [tags]) : [];

        const images = [];

        if (!req.files || Object.keys(req.files).length === 0) {
            req.flash("error_msg", "Please upload at least one image");
            const categories = await Category.find({ isListed: true });
            return res.render("admin/addProduct", {
                admin: req.session.admin,
                categories,
                error_msg: "Please upload at least one image",
            });
        }

        let hasMainImage = false;

        for (const fieldName in req.files) {
            const file = req.files[fieldName][0];

            const imageObj = {
                url: file.path,
                thumbnail: file.path.replace(
                    "/upload/",
                    "/upload/w_200,h_200,c_thumb/"
                ),
                isMain: !hasMainImage,
            };

            hasMainImage = true;
            images.push(imageObj);
        }

        const newProduct = new Product({
            name,
            description,
            categoryId: new mongoose.Types.ObjectId(categoryId),
            brand: brand || "",
            color,
            offer: Number(offer) || 0,
            images,
            variants,
            sku: sku || "",
            tags: tagArray,
            ratings: {
                average: 0,
                count: 0,
            },
            isActive: true,
            isDeleted: false,
        });

        await newProduct.save();

        req.flash("success_msg", "Product added successfully");
        res.redirect("/admin/products");
    } catch (error) {
        console.error(error);
        req.flash("error_msg", "Failed to add product: " + error.message);
        res.status(statusCode.INTERNAL_SERVER_ERROR).render("admin/addProduct", {
            admin: req.session.admin,
            error_msg: "Failed to add product: " + error.message,
        });
    }
};

const loadEditProduct = async (req, res) => {
    try {
        const productId = req.query.id;
        const product = await Product.findById(productId).populate("categoryId");

        if (!product) {
            req.flash("error_msg", "Product not found");
            return res.redirect("/admin/products");
        }

        const categories = await Category.find({ isListed: true });
        const admin = {
            name: req.session.admin.name,
            email: req.session.admin.email,
        };

        res.render("admin/editProduct", {
            admin,
            product,
            categories,
        });
    } catch (error) {
        console.error("Load edit products error:", error);
        req.flash("error_msg", "Server error");
        res.status(statusCode.INTERNAL_SERVER_ERROR).render("admin/editProduct", {
            error_msg: "Server error",
        });
    }
};

const editProduct = async (req, res) => {
    try {
        const {
            productId,
            name,
            description,
            color,
            offer,
            sizeInfo,
            additionalInfo,
            category,
            isDeleted,
        } = req.body;

        const variantPrices = req.body.varientPrice || {};
        const offerValue = parseFloat(offer) || 0;
        const sizes = ["6", "7", "8", "9", "10"];
        const variants = sizes.map((size) => {
            const price = parseFloat(variantPrices[size]) || 0;
            const discount = price * (offerValue / 100);
            const salePrice = price - discount;
            const quantity =
                req.body.varientquantity && req.body.varientquantity[size]
                    ? parseInt(req.body.varientquantity[size])
                    : 0;

            return {
                size,
                varientPrice: price,
                salePrice: Math.round(salePrice),
                varientquantity: quantity,
            };
        });
        const totalStock = variants.reduce((sum, v) => sum + v.varientquantity, 0);

        let images = [];

        if (req.files && Object.keys(req.files).length > 0) {
            for (const fieldName in req.files) {
                const file = req.files[fieldName][0];
                const imageObj = {
                    url: file.path,
                    thumbnail: file.path.replace(
                        "/upload/",
                        "/upload/w_200,h_200,c_thumb/"
                    ),
                    isMain: fieldName === "mainImage",
                };
                images.push(imageObj);
            }
        } else {
            const existingProduct = await Product.findById(productId);
            images = existingProduct.images;
        }

        await Product.findByIdAndUpdate(productId, {
            name,
            description,
            categoryId: new mongoose.Types.ObjectId(category),
            brand: req.body.brand || "",
            color,
            offer: offerValue,
            sizeInfo,
            additionalInfo: Array.isArray(additionalInfo)
                ? additionalInfo
                : [additionalInfo],
            variants,
            images,
            stockQuantity: totalStock,
            isActive: isDeleted !== "true",
            updatedAt: Date.now(),
        });
        req.flash("success_msg", "Product updated successfully");
        res.redirect("/admin/products");
    } catch (error) {
        console.error("Update product error:", error);
        req.flash("error_msg", "Failed to update product");
        res.redirect("/admin/products");
    }
};


const deleteProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }
        // for (const image of product.images) {
        //     try {
        //         const publicId = image.url.split("/").pop().split(".")[0];
        //         await cloudinary.uploader.destroy(publicId);
        //     } catch (error) {
        //         console.error("Error deleting image from Cloudinary:", error);
        //     }
        // }
        await Product.findByIdAndUpdate(productId,
            { isDeleted: true, isActive: false });
        return res.status(200).json({
            success: true,
            message: "Product deleted successfully",
        });
    } catch (error) {
        console.error(error);
        res.status(statusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: "Server error" });
    }
};

const toggleProductListing = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }
        const previousStatus = product.isActive;
        product.isActive = !product.isActive;
        await product.save();
        return res.status(200).json({
            success: true,
            message: product.isActive ? "Product listed successfully" : "Product unlisted successfully",
            isListed: product.isActive,
        });
    } catch (error) {
        console.error(`Error toggling product listing: ${error.message}`);
        res.status(statusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: "Server error" });
    }
};


module.exports = {
    loadProducts,
    loadAddProduct,
    addProduct,
    loadEditProduct,
    editProduct,
    deleteProduct,
    toggleProductListing,
}