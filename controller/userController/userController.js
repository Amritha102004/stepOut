const User = require('../../model/userModel');
const Product = require('../../model/productModel');
const Category = require('../../model/categoryModel');
const Wallet = require("../../model/walletModel")
const env = require('dotenv').config();
const statusCode = require("../../utils/httpStatusCodes");
const bcrypt = require("bcrypt");
const nodemailer = require('nodemailer');
const generateOtp = require('../../utils/otpGenerator');
const sendEmail = require('../../utils/sendEmail');
const securePassword = require('../../utils/hashPassword');
const { generateReferralCode, validateReferralCode } = require("../../utils/referralGenerator")


const loadHome = async (req, res) => {
    try {
        const user = req.session.user;
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

        const products = await Product.find({ isActive: true })
            .populate("categoryId")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const totalProducts = await Product.countDocuments({ isActive: true });
        const totalPages = Math.ceil(totalProducts / limit);

        const categories = await Category.find({ isListed: true }).lean();

        const brands = await Product.distinct("brand", { isActive: true });

        const colors = await Product.distinct("color", { isActive: true });

        return res.render('user/home', {
            products,
            currentPage: page,
            totalPages,
            totalProducts,
            categories,
            brands,
            colors,
            query: req.query,
            user
        });
    } catch (error) {
        console.log("homepage not loading:", error);
        res.status(statusCode.INTERNAL_SERVER_ERROR).send("server error");
    }
}

const loadSignup = async (req, res) => {
    try {
        return res.render('user/signUp', { errors: null, userData: null });
    } catch (error) {
        console.log("signUp page not loading:", error);
        res.status(statusCode.INTERNAL_SERVER_ERROR).send("server error");
    }
}

const signup = async (req, res) => {
    try {
        const { fullName, email, phoneNumber, password, confirmPassword, referralCode } = req.body;

        const errors = {};
        const userData = { fullName, email, phoneNumber };

        const nameRegex = /^[A-Za-z\s]{3,}$/;
        if (!fullName) {
            errors.fullName = "Full name is required";
        } else if (!nameRegex.test(fullName)) {
            errors.fullName = "Enter a valid full name (only letters, min 3 chars)";
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email) {
            errors.email = "Email is required";
        } else if (!emailRegex.test(email)) {
            errors.email = "Enter a valid email address";
        } else {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                errors.email = "Email already registered";
            }
        }

        const phoneRegex = /^\d{10}$/;
        if (!phoneNumber) {
            errors.phoneNumber = "Phone number is required";
        } else if (!phoneRegex.test(phoneNumber)) {
            errors.phoneNumber = "Enter a valid 10-digit phone number";
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@#$%^&*!])[A-Za-z\d@#$%^&*!]{8,}$/;
        if (!password) {
            errors.password = "Password is required";
        } else if (!passwordRegex.test(password)) {
            errors.password = "Password must be at least 8 characters and include uppercase, lowercase, number, and special character";
        }

        if (!confirmPassword) {
            errors.confirmPassword = "Please confirm your password";
        } else if (password !== confirmPassword) {
            errors.confirmPassword = "Passwords do not match";
        }

        let referrerUser = null
        if (referralCode && referralCode.trim() !== "") {
            const referralValidation = await validateReferralCode(referralCode)
            if (!referralValidation.valid) {
                errors.referralCode = referralValidation.message
            } else {
                referrerUser = referralValidation.referrer
            }
        }

        if (Object.keys(errors).length > 0) {
            return res.render('user/signUp', { 
                errors, 
                userData
            });
        }

        const otp = generateOtp();
        const emailsent = await sendEmail.sendVerificationEmail(email, otp);

        if (!emailsent) {
            return res.json('email error');
        }

        req.session.userOtp = otp;
        req.session.otpType = 'signup';
        req.session.userData = {
            fullName,
            email,
            phoneNumber,
            password,
            referredBy: referrerUser ? referrerUser.referralCode : null,
            referrerUserId: referrerUser ? referrerUser._id : null,
        };

        res.render('user/otpVerification', { error: null });
        console.log('otp sented ', otp);

    } catch (error) {
        console.log('Error during signup:', error);
        res.status(statusCode.INTERNAL_SERVER_ERROR).send("server error");
    }
}



const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        console.log(otp); ////////
        const otpType = req.session.otpType;

        if (otpType === 'signup' && otp == req.session.userOtp) {
            const user = req.session.userData;
            const passwordHash = await securePassword(user.password);

            const newUserReferralCode = await generateReferralCode(user.fullName)

            const saveUserData = new User({
                fullName: user.fullName,
                email: user.email,
                password: passwordHash,
                phoneNumber: user.phoneNumber,
                referralCode: newUserReferralCode,
                referredBy: user.referredBy,
            });

            await saveUserData.save();

            const newWallet = new Wallet({
                userId: saveUserData._id,
                balance: 0,
                transactions: [],
            })
            await newWallet.save()
            
            if (user.referrerUserId) {
                await processReferralReward(user.referrerUserId, saveUserData._id)
            }

            req.session.userOtp = null;                                                                                      // Clear OTP-related session data
            req.session.userData = null;
            req.session.otpType = null;

            return res.redirect("/login");
        }

        if (otpType === 'reset' && otp == req.session.secondOtp) {
            req.session.otpType = null;                                                                                 // Keep verifiedEmail for next step
            return res.redirect("/resetpassword");
        }

        if(otpType==='email' && otp == req.session.userOtp){
            req.session.otpType=null;
            req.session.userOtp=null; 
            const user = req.session.userData;
            const updatedUser=await User.findOneAndUpdate(
                {_id: req.session.user._id },
                {
                fullName:user.fullName,
                email:user.email,
                phoneNumber:user.phoneNumber,
                },
                { new: true }
            );
            req.session.user=updatedUser
            req.flash("success_msg", "Updated info successfully")
            return res.redirect('/account');/////json

        }

        return res.render("user/otpVerification", { error: "Incorrect OTP. Please try again." });

    } catch (error) {
        console.error("Error verifying OTP", error);
        res.status(statusCode.INTERNAL_SERVER_ERROR).json({ success: false, error: 'An error occurred' });
    }
};

const processReferralReward = async (referrerUserId, newUserId) => {
  try {
    const REFERRAL_REWARD = 500 

    let referrerWallet = await Wallet.findOne({ userId: referrerUserId })
    if (!referrerWallet) {
      referrerWallet = new Wallet({
        userId: referrerUserId,
        balance: 0,
        transactions: [],
      })
    }

    referrerWallet.transactions.push({
      type: "credit",
      amount: REFERRAL_REWARD,
      reason: `Referral bonus - New user joined using your code`,
      date: new Date(),
    })

    referrerWallet.balance += REFERRAL_REWARD
    await referrerWallet.save()

    console.log(`Referral reward of ₹${REFERRAL_REWARD} added to user ${referrerUserId}`)

    return { success: true }
  } catch (error) {
    console.error("Error processing referral reward:", error)
    return { success: false, error: error.message }
  }
}

const resendOtp = async (req, res) => {
    try {
        const otpType = req.session.otpType;

        if (otpType === 'signup') {
            const { email } = req.session.userData;
            const newOtp = generateOtp();
            req.session.userOtp = newOtp;

            const emailSent = await sendEmail.sendVerificationEmail(email, newOtp);
            if (emailSent) {
                console.log("Resent signup OTP:", newOtp);////////
                return res.status(statusCode.OK).json({ success: true });
            } else {
                return res.json({ success: false, error: "Failed to resend OTP" });
            }
        }

        else if (otpType === 'reset') {
            const email = req.session.verifiedEmail;
            const newOtp = generateOtp();
            req.session.secondOtp = newOtp;

            ////util//

            const transporter = nodemailer.createTransport({
                service: "gmail",
                auth: {
                    user: process.env.NODEMAILER_EMAIL,
                    pass: process.env.NODEMAILER_PASSWORD,
                },
            });

            await transporter.sendMail({
                from: `"stepOut Support" <${process.env.NODEMAILER_EMAIL}>`,
                to: email,
                subject: "Reset your stepOut password",
                text: `Your OTP is ${newOtp}`,
            });

            console.log("Resent reset password OTP:", newOtp);    ////////
            return res.status(statusCode.OK).json({ success: true });
        }

        else {
            return res.status(statusCode.BAD_REQUEST).json({ success: false, error: "Invalid OTP type or session expired" });
        }

    } catch (error) {
        console.error("Error resending OTP", error);
        res.status(statusCode.INTERNAL_SERVER_ERROR).json({ success: false, error: "Server error" });
    }
};



const loadLogin = async (req, res) => {
    try {
        return res.render('user/login', { error: null });
    } catch (error) {
        console.log("login page not loading:", error);
        res.status(statusCode.INTERNAL_SERVER_ERROR).send("server error");
    }
}


const login = async (req, res) => {
    try {

        const { email, password } = req.body;
        const finduser = await User.findOne({ isAdmin: 0, email: email })

        if (!finduser) {
            return res.render("user/login", { error: "user not found" })
        } if (finduser.isBlocked) {
            return res.render('user/login', { error: "user is blocked by admin" })
        }

        const passwordmatch = await bcrypt.compare(password, finduser.password)
        if (!passwordmatch) {
            return res.render('user/login', { error: "incorrect password" })
        }

        req.session.user = finduser
        res.redirect('/')

    } catch (error) {

        console.log('loggin error', error);
        res.render('user/login', { error: "login failed , please try again later" })

    }
}


const loadForgotPassword = async (req, res) => {
    try {
        return res.render('user/forgotPassword', { error: null });
    } catch (error) {
        console.log("login page not loading:", error);
        res.status(statusCode.INTERNAL_SERVER_ERROR).send("server error");
    }
}


const handleForgotPassword = async (req, res) => {
    try {

        const { email } = req.body;
        const user = await User.findOne({ email })
        req.session.verifiedEmail = email;
        if (!user) {
            return res.render('user/forgotPassword', { error: 'something wrong no user found' })
        }

        const otp = generateOtp()
        req.session.secondOtp = otp;
        req.session.otpType = 'reset';

        
        // const emailsent = await sendEmail.sendVerificationEmail(email, otp);

        // if (!emailsent) {
        //     return res.json('email error');
        // }

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            },
        });

        await transporter.sendMail({
            from: `"stepOut Support" <${process.env.NODEMAILER_EMAIL}>`,
            to: email,
            subject: "Reset your stepOut password",
            text: `Your OTP is ${otp}`,
        });
        console.log("reset password OTP:", otp);//////

        res.render("user/otpVerification", { email: null, error: null });


    } catch (error) {
        console.log("something wrong with forgotpassword:", error);
        res.status(statusCode.INTERNAL_SERVER_ERROR).send("server error");
    }
}


const loadResetPassword = async (req, res) => {
    try {
        return res.render('user/resetPassword');
    } catch (error) {
        console.log("resetpassword page not loading:", error);
        res.status(statusCode.INTERNAL_SERVER_ERROR).send("server error");
    }
}


const changePassword = async (req, res) => {
    try {
        const { password } = req.body;
        const email = req.session.verifiedEmail;
        const passwordHash = await securePassword(password);
        await User.findOneAndUpdate({ email }, { password: passwordHash });

        req.session.verifiedEmail = null;
        req.session.secondOtp = null;
        res.redirect('/login');

    } catch (error) {
        console.error(error);
        res.status(statusCode.INTERNAL_SERVER_ERROR).send("Something went wrong");
        console.log(req.body);

    }
}


const logout = async (req, res) => {
    try {
        req.session.destroy(() => {
            res.redirect('/');                                                                                          // Redirect after destroying session
        });
    } catch (error) {
        console.log('error during logout:', error)
        res.status(statusCode.INTERNAL_SERVER_ERROR).send('error during logout')
    }
}

const about = async (req,res) => {
    try {
        const user = req.session.user
        res.render('user/about',{user})
    } catch (error) {
        console.log(error);
        res.status(statusCode.INTERNAL_SERVER_ERROR).send('cannot load about page')
    }
}

const contact = async (req,res) => {
    try {
        const user = req.session.user
        res.render('user/contact',{user})
    } catch (error) {
        console.log(error);
        res.status(statusCode.INTERNAL_SERVER_ERROR).send('cannot load contact page')
    }
}
module.exports = {
    loadHome,
    loadSignup,
    signup,
    loadLogin,
    verifyOtp,
    resendOtp,
    login,
    loadForgotPassword,
    handleForgotPassword,
    loadResetPassword,
    changePassword,
    about,
    contact,
    logout,
}





