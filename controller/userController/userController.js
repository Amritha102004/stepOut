const User = require('../../model/userModel');
const Product=require('../../model/productModel');
const Category=require('../../model/categoryModel')
const env = require('dotenv').config();
const statusCode = require("../../utils/httpStatusCodes")
const bcrypt = require("bcrypt");
const nodemailer = require('nodemailer');


const loadHome = async (req, res) => {
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

        const products = await Product.find({isActive:true})
                    .populate("categoryId")
                    .sort({createdAt:-1})
                    .skip(skip)
                    .limit(limit)
                    .lean();
        
        const totalProducts = await Product.countDocuments({isActive: true});
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
            req });
    } catch (error) {
        console.log("homepage not loading:", error);
        res.status(statusCode.INTERNAL_SERVER_ERROR).send("server error");
    }
}

const loadSignup = async (req, res) => {
    try {
        return res.render('user/signUp', { error: null });
    } catch (error) {
        console.log("signUp page not loading:", error);
        res.status(statusCode.INTERNAL_SERVER_ERROR).send("server error");
    }
}



function generateOtp() {
    return Math.floor(10000 + Math.random() * 90000);
}


async function sendVerificationEmail(email, otp) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        })

        const info = await transporter.sendMail({
            from: ` "stepOut Support" <${process.env.NODEMAILER_EMAIL}>`,
            to: email,
            subject: "Verify Your stepOut Account ✔",
            text: `Your OTP is: ${otp}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border-radius: 10px; background: #f4f4f4;">
                <h2 style="color: #333;">Welcome to <span style="color: #27ae60;">stepOut</span>!</h2>
                <p>Thanks for signing up! Use the OTP below to verify your account:</p>
                <div style="padding: 15px; background: #fff; border-radius: 8px; margin: 20px 0; text-align: center;">
                  <h1 style="color: #27ae60;">${otp}</h1>
                </div>
                <p>If you didn’t request this, you can ignore it.</p>
                <p style="font-size: 12px; color: #999; margin-top: 30px;">
                  stepOut Inc. | stepOut.com | support@stepOut.com
                </p>
              </div>`,
            headers: {
                'X-Priority': '3',
                'X-Mailer': 'stepOut Mailer'
            }
        });

        return info.accepted.length > 0

    } catch (error) {
        console.error("ERROR SENDING EMAIL", error);
        return false

    }
}




const signup = async (req, res) => {

    try {
        const { fullName, email, phoneNumber, password, confirmPassword } = req.body;

        if (!fullName || !email || !phoneNumber || !password || !confirmPassword) {
            return res.render('user/signUp', { error: "All fields are required" });
        }

        const nameRegex = /^[A-Za-z\s]{3,}$/;
        if (!nameRegex.test(fullName)) {
            return res.render('user/signUp', { error: "Enter a valid full name (only letters, min 3 chars)" });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.render('user/signUp', { error: "Enter a valid email address" });
        }

        if (password !== confirmPassword) {
            return res.render('user/signUp', { error: "Passwords do not match" });
        }

        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(phoneNumber)) {
            return res.render('user/signUp', { error: "Enter a valid 10-digit phone number" });
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@#$%^&*!])[A-Za-z\d@#$%^&*!]{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.render('user/signUp', {
               error: "Password must be at least 8 characters and include uppercase, lowercase, number, and special character"
            });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render('user/signUp', { error: "Email already registered" });
        }

        const otp = generateOtp()
        const emailsent = await sendVerificationEmail(email, otp)

        if (!emailsent) {
            return res.json('email error')
        }

        req.session.userOtp = otp;
        req.session.otpType = 'signup';
        req.session.userData = { fullName, email, phoneNumber, password }

        res.render('user/otpVerification', { error: null })
        console.log('otp sented ', otp);                    //////


    } catch (error) {
        console.log('Error during signup:', error);
        res.status(statusCode.INTERNAL_SERVER_ERROR).send("server error");
    }
}


const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10)
        return passwordHash

    } catch (error) {
        console.error("Password hash error:", error);
        throw error;
    }
}


const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        console.log(otp);                                               ////////
        const otpType = req.session.otpType;

        if (otpType === 'signup' && otp == req.session.userOtp) {
            const user = req.session.userData;
            const passwordHash = await securePassword(user.password);

            const saveUserData = new User({
                fullName: user.fullName,
                email: user.email,
                password: passwordHash,
                phoneNumber: user.phoneNumber
            });

            await saveUserData.save();
            

            req.session.userOtp = null;                                                                                      // Clear OTP-related session data
            req.session.userData = null;
            req.session.otpType = null;

            return res.redirect("/login");
        }

        if (otpType === 'reset' && otp == req.session.secondOtp) {
            req.session.otpType = null;                                                                                    // Keep verifiedEmail for next step
            return res.redirect("/resetpassword");
        }

        return res.render("user/otpVerification", { error: "Incorrect OTP. Please try again." });

    } catch (error) {
        console.error("Error verifying OTP", error);
        res.status(statusCode.INTERNAL_SERVER_ERROR).json({ success: false, error: 'An error occurred' });
    }
};



const resendOtp = async (req, res) => {
    try {
        const otpType = req.session.otpType;

        if (otpType === 'signup') {
            const { email } = req.session.userData;
            const newOtp = generateOtp();
            req.session.userOtp = newOtp;

            const emailSent = await sendVerificationEmail(email, newOtp);
            if (emailSent) {
                console.log("Resent signup OTP:", newOtp);          ////////
                return res.status(statusCode.OK).json({ success: true });
            } else {
                return res.json({ success: false, error: "Failed to resend OTP" });
            }
        }

        else if (otpType === 'reset') {
            const email = req.session.verifiedEmail;
            const newOtp = generateOtp();
            req.session.secondOtp = newOtp;

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
        console.log("reset password OTP:", otp);


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

        const hashedPassword = await bcrypt.hash(password, 10);
        await User.findOneAndUpdate({ email }, { password: hashedPassword });

        req.session.verifiedEmail = null;
        req.session.secondOtp = null;
        res.redirect('/login');

    } catch (error) {
        console.error(error);
        res.status(statusCode.INTERNAL_SERVER_ERROR).send("Something went wrong");
        console.log(req.body);

    }
}

const loadShop=async (req,res)=>{
    try {
        res.render('user/shop',{req});
    } catch (error) {
        console.log('shop page not rendering',error);
        res.status(statusCode.INTERNAL_SERVER_ERROR).send("somethingg went wrong");
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
    loadShop,
    logout,
}





