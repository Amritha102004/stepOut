const User = require('../../model/userModel');
const Order = require("../../model/orderModel");
const env = require('dotenv').config();
const bcrypt = require("bcrypt");
const statusCode = require("../../utils/httpStatusCodes")

const loadlogin=async (req,res)=>{
    try {
        if(req.session.admin){
            return res.redirect('/admin/dashboard');
        }
            res.render('admin/login',{error:null});
        
    } catch (error) {
        console.log("admin login page not loading:", error);
        res.status(statusCode.INTERNAL_SERVER_ERROR).send("server error");
    }
}

const login = async (req, res) => {
    try {

        const { email, password } = req.body;
        const findadmin = await User.findOne({ isAdmin: true, email: email })

        if (!findadmin) {
            return res.render("admin/login", { error: "invalid credentials" })
        }

        const passwordmatch = await bcrypt.compare(password, findadmin.password)
        if (!passwordmatch) {
            return res.render('admin/login', { error: "incorrect password" })
        }
 
        req.session.admin = {
            id: findadmin._id,
            email: findadmin.email,
            name:findadmin.fullName,
            isAdmin:findadmin.isAdmin,
          };
        res.redirect('/admin/dashboard')

    } catch (error) {

        console.log('loggin error', error);
        res.render('admin/login', { error: "login failed , please try again later" })

    }
}


const logout=async (req,res)=>{
    try {
        req.session.destroy(() => {
            res.redirect('/admin/login');                   
        });
    } catch (error) {
        console.log('error during logout:',error);
        res.status(statusCode.INTERNAL_SERVER_ERROR).send('error during logout');
    }
}


module.exports = {
    loadlogin,
    login,
    logout,
}