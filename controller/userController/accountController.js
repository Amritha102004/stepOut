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

const loadAccount = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const address = await Address.findOne({ user: userId ,isDefault:true});
        if (!address) {
            return res.render('user/userAccount', { req ,address:null});
        }
        res.render('user/userAccount', { req ,address})
    } catch (error) {
        res.status(statusCode.INTERNAL_SERVER_ERROR).json({ error: "page not loading" })
    }
}

const loadEditAccount = async (req, res) => {
    try {
        res.render('user/editAccount', { req, errors: null })
    } catch (error) {
        res.status(statusCode.INTERNAL_SERVER_ERROR).json({ error: "page not loading" })
    }
}

const editAccount = async (req, res) => {
    try {
        const user = await User.findOne({ _id: req.session.user._id })
        const { fullName, email, phoneNumber } = req.body
        if (!user) {
            return res.render('user/editAccount', { error: "something wrong user not found" })
        }
        const errors = {};
        const nameRegex = /^[A-Za-z\s]{3,}$/;
        if (!fullName) {
            errors.fullName = "Full name is required";
        } else if (!nameRegex.test(fullName)) {
            errors.fullName = "Enter a valid full name (only letters, min 3 chars)";
        }

        const phoneRegex = /^\d{10}$/;
        if (!phoneNumber) {
            errors.phoneNumber = "Phone number is required";
        } else if (!phoneRegex.test(phoneNumber)) {
            errors.phoneNumber = "Enter a valid 10-digit phone number";
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email) {
            errors.email = "Email is required";
        } else if (!emailRegex.test(email)) {
            errors.email = "Enter a valid email address";
        } else {
            const existingUser = await User.findOne({ email });
            if (existingUser && email != req.session.user.email) {
                errors.email = "Email already registered";
            }
        }

        if (Object.keys(errors).length > 0) {
            return res.render('user/editAccount', {
                errors,
                req,
            });
        }

        if (email !== user.email) {
            const otp = generateOtp();
            const emailsent = await sendEmail.sendVerificationEmail(email, otp);
            if (!emailsent) {
                return res.json('email error');
            }
            req.session.userOtp = otp;
            req.session.otpType = 'email';
            req.session.userData = { fullName, email, phoneNumber }
            console.log('otp sented ', otp);/////
            return res.render('user/otpVerification', { error: null });

        }
        console.log(req.session.user)/////d
        const updatedUser = await User.findOneAndUpdate(
            { _id: req.session.user._id },
            {
                fullName: fullName,
                phoneNumber: phoneNumber,
            },
            { new: true }

        );
        req.session.user = updatedUser;
        console.log(req.session.user)/////d

        req.flash("success_msg", "Updated info successfully")
        res.redirect('/account');

    } catch (error) {
        console.log(error)
        res.status(statusCode.INTERNAL_SERVER_ERROR).json({ error: "cannot update" })
    }
}

const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const finduser = await User.findOne({ _id: req.session.user._id });
        const passwordMatch = await bcrypt.compare(currentPassword, finduser.password);
        const errors = {};

        if (!currentPassword) {
            errors.currentPassword = "Current password is required"
        } else if (!passwordMatch) {
            errors.currentPassword = "Invalid password"
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@#$%^&*!])[A-Za-z\d@#$%^&*!]{8,}$/;
        if (!newPassword) {
            errors.newPassword = "Password is required";
        } else if (!passwordRegex.test(newPassword)) {
            errors.newPassword = "Password must be at least 8 characters and include uppercase, lowercase, number, and special character";
        }

        if (!confirmPassword) {
            errors.confirmPassword = "Please confirm your password";
        } else if (newPassword !== confirmPassword) {
            errors.confirmPassword = "Passwords do not match";
        }

        if (Object.keys(errors).length > 0) {
            return res.render('user/editAccount', {
                errors,
                req,
            });
        }

        const passwordHash = await securePassword(newPassword);
        await User.findOneAndUpdate({ _id: finduser._id }, { password: passwordHash });

        req.flash("success_msg", "Updated the password successfully")
        res.redirect('/account');

    } catch (error) {
        console.log(error)
        res.status(statusCode.INTERNAL_SERVER_ERROR).json({ error: "cannot update password" })
    }
}

module.exports = {
    loadAccount,
    loadEditAccount,
    editAccount,
    changePassword
}