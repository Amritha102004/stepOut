const Product = require('../../model/productModel');
const Category = require('../../model/categoryModel');
const mongoose = require('mongoose');

const getAllProducts = async (req, res, next) => {
    try {
        const page = Number.parseInt(req.query.page) || 1;
        const limit = Number.parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;

        const query = { isActive: true };

        if (req.query.search) {
            query.$or = [
                { name: { $regex: req.query.search, $options: "i" } },
                { brand: { $regex: req.query.search, $options: "i" } },
                { description: { $regex: req.query.search, $options: "i" } },
                { tags: { $in: [new RegExp(req.query.search, "i")] } },
            ];
        }

        if (req.query.category) {
            query.categoryId = req.query.category;
        }

        if (req.query.brand) {
            query.brand = { $regex: req.query.brand, $options: "i" };
        }

        let sortOption = {};
        switch (req.query.sort) {
            case "price_asc":
                sortOption = { "variants.0.salePrice": 1 };
                break;
            case "price_desc":
                sortOption = { "variants.0.salePrice": -1 };
                break;
            case "name_asc":
                sortOption = { name: 1 };
                break;
            case "name_desc":
                sortOption = { name: -1 };
                break;
            case "popularity":
                sortOption = { "ratings.count": -1 };
                break;
            case "rating":
                sortOption = { "ratings.average": -1 };
                break;
            case "newest":
                sortOption = { createdAt: -1 };
                break;
            default:
                sortOption = { createdAt: -1 };
        }

        if (req.query.minPrice || req.query.maxPrice) {
            const priceFilter = {};

            if (req.query.minPrice) priceFilter.$gte = Number.parseFloat(req.query.minPrice);
            if (req.query.maxPrice) priceFilter.$lte = Number.parseFloat(req.query.maxPrice);

            query["variants.salePrice"] = priceFilter;
        }

        const products = await Product.find(query)
            .populate("categoryId")
            .sort(sortOption)
            .skip(skip)
            .limit(limit)
            .lean();

        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        const categories = await Category.find({ isListed: true }).lean();

        const brands = await Product.distinct("brand", { isActive: true });

        const colors = await Product.distinct("color", { isActive: true });///

        res.render("user/shop", {
            products,
            currentPage: page,
            totalPages,
            totalProducts,
            categories,
            brands,
            colors,
            query: req.query,
            filters: {
                category: req.query.category || "",
                brand: req.query.brand || "",
                color: req.query.color || "",
                minPrice: req.query.minPrice || "",
                maxPrice: req.query.maxPrice || "",
                sort: req.query.sort || "newest",
                search: req.query.search || "",
            },
            user: req.session.user || null,
            req
        });
    } catch (error) {
        console.error("Product listing error:", error);
        req.flash("error_msg", "Failed to load products");
        res.redirect("/");
    }
};

const getProductDetails = async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            req.flash("error_msg", "Invalid product ID");
            return res.redirect("/shop");
        }

        const product = await Product.findById(req.params.id)
            .populate("categoryId")
            .lean();

        

        if (!product || !product.isActive) {
            req.flash("error_msg", "Product not available");
            return res.redirect("/shop");
        }

        const relatedProducts = await Product.find({
            categoryId: product.categoryId._id,
            _id: { $ne: product._id },
            isActive: true,
        })
            .limit(4)
            .lean();

        res.render("user/product-details", {
            product,
            relatedProducts,
            user: req.session.user || null,
            req
        });
    } catch (error) {
        console.error("Product details error:", error);
        req.flash("error_msg", "Failed to load product details");
        res.redirect("/shop");
    }
};

module.exports = {
    getAllProducts,
    getProductDetails
};