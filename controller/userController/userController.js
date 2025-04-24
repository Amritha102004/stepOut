const User = require('../../model/userModel');
const env = require('dotenv').config();
const bcrypt = require("bcrypt");
const nodemailer = require('nodemailer')


const loadHome = async (req, res) => {
    try {
        return res.render('user/home', { req });
    } catch (error) {
        console.log("homepage not loading:", error);
        res.status(500).send("server error");
    }
}

const loadSignup = async (req, res) => {
    try {
        return res.render('user/signUp', { error: null });
    } catch (error) {
        console.log("signUp page not loading:", error);
        res.status(500).send("server error");
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

        if (password !== confirmPassword) {
            return res.render('user/signUp', { error: "Passwords do not match" });
        }

        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(phoneNumber)) {
            return res.render('user/signUp', { error: "Enter a valid 10-digit phone number" });
        }

        if (!fullName || !email || !phoneNumber || !password || !confirmPassword) {
            return res.render('user/signUp', { error: "All fields are required" });
        }

        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
        if (!passwordRegex.test(password)) {
            return res.render('user/signUp', { error: "Password must be at least 6 characters and include a number" });
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
        req.session.userData = { fullName, email, phoneNumber, password }

        res.render('user/otpVerification', { error: null })
        console.log('otp sented ', otp);


    } catch (error) {
        console.log('Error during signup:', error);
        res.status(500).send("server error");
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
        console.log(otp);

        if (otp == req.session.userOtp) {
            const user = req.session.userData;
            const passwordHash = await securePassword(user.password);

            const saveUserData = new User({
                fullName: user.fullName,
                email: user.email,
                password: passwordHash,
                phoneNumber: user.phoneNumber
            })
            await saveUserData.save()
            req.session.user = saveUserData._id;

            res.redirect("/");
        }

        else if (otp !== req.session.secondOtp) {
            res.redirect("/resetpassword");
        }

        else {
            res.render("user/otpVerification", { error: "Incorrect OTP. Please try again." });
        }

    } catch (error) {
        console.error("error verifying otp", error);
        res.status(500).json({ success: false, error: 'an error occured' });            //////////

    }

}


const resendOtp = async (req, res) => {
    try {
        const { email } = req.session.userData;
        if (!email) {
            return res.status(400).json({ success: false, error: "Session expired" });
        }

        const newOtp = generateOtp();
        req.session.userOtp = newOtp;

        const emailSent = await sendVerificationEmail(email, newOtp);

        if (emailSent) {
            console.log('resend otp ', newOtp);

            res.status(200).json({ success: true });
        } else {
            res.json({ success: false, error: "Failed to resend OTP" });
        }
    } catch (error) {
        console.error("Error resending OTP", error);
        res.status(500).json({ success: false, error: "Server error" });
    }
};


const loadLogin = async (req, res) => {
    try {
        return res.render('user/login', { error: null });
    } catch (error) {
        console.log("login page not loading:", error);
        res.status(500).send("server error");
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

        req.session.user = finduser._id
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
        res.status(500).send("server error");
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
        req.session.secondOtp = otp
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
        console.log(otp);


        res.render("user/otpVerification", { email: null, error: null });


    } catch (error) {
        console.log("something wrong with forgotpassword:", error);
        res.status(500).send("server error");
    }
}





const loadResetPassword = async (req, res) => {
    try {
        return res.render('user/resetPassword');
    } catch (error) {
        console.log("resetpassword page not loading:", error);
        res.status(500).send("server error");
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
        res.status(500).send("Something went wrong");
        console.log(req.body);

    }
}


const logout=async (req,res)=>{
    try {
        req.session.destroy(() => {
            res.redirect('/');                   // Redirect after destroying session
        });
    } catch (error) {
        console.log('error during logout:',error)
        res.status(500).send('error during logout')
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



// const newUser=new User({fullName,email,phoneNumber,password});
// console.log(newUser);
// await newUser.save();
// return res.redirect('/signup');   ///////changeeeee
// } catch (error) {
// console.log("error for save user:",error);
// res.status(500).send("Internal Sersver Error");
// }




