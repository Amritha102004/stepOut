const User = require('../../model/userModel');
const Product = require('../../model/productModel');
const Category = require('../../model/categoryModel');
const Address = require('../../model/addressModel');
const Cart = require('../../model/cartModel');
const Wishlist = require('../../model/wishlistModel');
const Order = require('../../model/orderModel');
const mongoose = require('mongoose');
const statusCode = require("../../utils/httpStatusCodes");
const generateOtp = require('../../utils/otpGenerator');
const sendEmail = require('../../utils/sendEmail');
const bcrypt = require("bcrypt");
const securePassword = require('../../utils/hashPassword');




const loadCart = async (req, res) => {
    try {

    } catch (error) {
        console.log(error)
        res.status(statusCode.INTERNAL_SERVER_ERROR).send("cannot load cart page")
    }
}


module.exports={
    loadCart,
}