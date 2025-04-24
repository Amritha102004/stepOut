const express=require('express');
const app=express();
const connectDB=require('./config/connectDB');
const path = require('path');
const session = require('express-session');
const nocache = require('nocache');
const env = require('dotenv').config();
const adminRoute=require('./routes/adminRoute');
const userRoute=require('./routes/userRoute');
const passport=require('./config/passport');

//View Engine Setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
//Static Assets
app.use(express.static(path.join(__dirname,'public')));
//parsing
app.use(express.urlencoded({extended: true}));
app.use(express.json());

app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:true,
    cookie:{
        secure:false,
        httpOnly:true,
        maxAge:72*60*60*1000
    }
}))

app.use(passport.initialize());
app.use(passport.session());

app.use('/',userRoute)
app.use('/admin',adminRoute)



connectDB();

app.listen(3000, ()=>{
    console.log("Server running in port: http://localhost:3000 ");
})