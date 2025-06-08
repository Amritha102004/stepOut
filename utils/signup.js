const User = require("../../model/userModel")
const Product = require("../../model/productModel")
const Category = require("../../model/categoryModel")
const Wallet = require("../../model/walletModel")
const env = require("dotenv").config()
const statusCode = require("../../utils/httpStatusCodes")
const bcrypt = require("bcrypt")
const nodemailer = require("nodemailer")
const generateOtp = require("../../utils/otpGenerator")
const sendEmail = require("../../utils/sendEmail")
const securePassword = require("../../utils/hashPassword")
const { generateReferralCode, validateReferralCode } = require("../../utils/referralGenerator")

// Declare the missing functions
const loadHome = (req, res) => {
  // Implementation for loadHome
}

const loadSignup = (req, res) => {
  // Implementation for loadSignup
}

const loadLogin = (req, res) => {
  // Implementation for loadLogin
}

const resendOtp = async (req, res) => {
  // Implementation for resendOtp
}

const login = async (req, res) => {
  // Implementation for login
}

const loadForgotPassword = (req, res) => {
  // Implementation for loadForgotPassword
}

const handleForgotPassword = async (req, res) => {
  // Implementation for handleForgotPassword
}

const loadResetPassword = (req, res) => {
  // Implementation for loadResetPassword
}

const changePassword = async (req, res) => {
  // Implementation for changePassword
}

const logout = (req, res) => {
  // Implementation for logout
}

const signup = async (req, res) => {
  try {
    const { fullName, email, phoneNumber, password, confirmPassword, referralCode } = req.body

    const errors = {}
    const userData = { fullName, email, phoneNumber, referralCode }

    const nameRegex = /^[A-Za-z\s]{3,}$/
    if (!fullName) {
      errors.fullName = "Full name is required"
    } else if (!nameRegex.test(fullName)) {
      errors.fullName = "Enter a valid full name (only letters, min 3 chars)"
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email) {
      errors.email = "Email is required"
    } else if (!emailRegex.test(email)) {
      errors.email = "Enter a valid email address"
    } else {
      const existingUser = await User.findOne({ email })
      if (existingUser) {
        errors.email = "Email already registered"
      }
    }

    const phoneRegex = /^\d{10}$/
    if (!phoneNumber) {
      errors.phoneNumber = "Phone number is required"
    } else if (!phoneRegex.test(phoneNumber)) {
      errors.phoneNumber = "Enter a valid 10-digit phone number"
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@#$%^&*!])[A-Za-z\d@#$%^&*!]{8,}$/
    if (!password) {
      errors.password = "Password is required"
    } else if (!passwordRegex.test(password)) {
      errors.password =
        "Password must be at least 8 characters and include uppercase, lowercase, number, and special character"
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Please confirm your password"
    } else if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match"
    }

    // Validate referral code if provided
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
      return res.render("user/signUp", {
        errors,
        userData,
      })
    }

    const otp = generateOtp()
    const emailsent = await sendEmail.sendVerificationEmail(email, otp)

    if (!emailsent) {
      return res.json("email error")
    }

    req.session.userOtp = otp
    req.session.otpType = "signup"
    req.session.userData = {
      fullName,
      email,
      phoneNumber,
      password,
      referredBy: referrerUser ? referrerUser.referralCode : null,
      referrerUserId: referrerUser ? referrerUser._id : null,
    }

    res.render("user/otpVerification", { error: null })
    console.log("otp sented ", otp)
  } catch (error) {
    console.log("Error during signup:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).send("server error")
  }
}

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body
    console.log(otp)
    const otpType = req.session.otpType

    if (otpType === "signup" && otp == req.session.userOtp) {
      const user = req.session.userData
      const passwordHash = await securePassword(user.password)

      // Generate unique referral code for new user
      const newUserReferralCode = await generateReferralCode(user.fullName)

      const saveUserData = new User({
        fullName: user.fullName,
        email: user.email,
        password: passwordHash,
        phoneNumber: user.phoneNumber,
        referralCode: newUserReferralCode,
        referredBy: user.referredBy,
      })

      await saveUserData.save()

      // Create wallet for new user
      const newWallet = new Wallet({
        userId: saveUserData._id,
        balance: 0,
        transactions: [],
      })
      await newWallet.save()

      // Process referral reward if user was referred
      if (user.referrerUserId) {
        await processReferralReward(user.referrerUserId, saveUserData._id)
      }

      req.session.userOtp = null
      req.session.userData = null
      req.session.otpType = null

      return res.redirect("/login")
    }

    // ... keep your existing reset and email OTP logic ...

    return res.render("user/otpVerification", { error: "Incorrect OTP. Please try again." })
  } catch (error) {
    console.error("Error verifying OTP", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({ success: false, error: "An error occurred" })
  }
}

// New function to process referral rewards
const processReferralReward = async (referrerUserId, newUserId) => {
  try {
    const REFERRAL_REWARD = 500 // ₹500 reward

    // Find or create referrer's wallet
    let referrerWallet = await Wallet.findOne({ userId: referrerUserId })
    if (!referrerWallet) {
      referrerWallet = new Wallet({
        userId: referrerUserId,
        balance: 0,
        transactions: [],
      })
    }

    // Add referral reward to referrer's wallet
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
  logout,
}
