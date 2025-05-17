const env = require('dotenv').config();
const nodemailer = require('nodemailer');


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

async function sendPasswordEmail(email, otp) {
    try {

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

    } catch (error) {

    }
}

module.exports = {
    sendVerificationEmail,
    sendPasswordEmail,
}