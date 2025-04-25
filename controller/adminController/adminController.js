const User = require('../../model/userModel');
const env = require('dotenv').config();
const bcrypt = require("bcrypt");

const loadlogin=async (req,res)=>{
    try {
        if(req.session.admin){
            res.redirect('/admin/dashboard');
        }else{
            return res.render('admin/login',{error:null});
        }
    } catch (error) {
        console.log("admin login page not loading:", error);
        res.status(500).send("server error");
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
 
        req.session.admin = findadmin._id
        res.redirect('/admin/dashboard')

    } catch (error) {

        console.log('loggin error', error);
        res.render('admin/login', { error: "login failed , please try again later" })

    }
}

const loadDashboard=async (req,res)=>{
    try {
        if(req.session.admin){
            return res.render('admin/dashboard');
        }else{
            return res.render('admin/login',{error:null});
        }
    } catch (error) {
        console.log('something wrong:',error);
        res.status(500).send(error);
    }
}



const logout=async (req,res)=>{
    try {
        req.session.destroy(() => {
            res.redirect('/admin/login');                   // Redirect after destroying session
        });
    } catch (error) {
        console.log('error during logout:',error);
        res.status(500).send('error during logout');
    }
}




module.exports = {
    loadlogin,
    login,
    loadDashboard,
    logout,
}