const User=require('../model/userModel')
const checkSession=(req,res,next)=>{
    if(req.session.user){
        return next()
    }
    res.render('user/login',{error:"please login or signup"}); 
}

const isBlocked=(req,res,next)=>{
    if(req.session.user){
        User.findById(req.session.user._id)
        .then(data => {
            if (data && data.isBlocked) {
                return res.render('user/login',{error:"user is blocked by admin"});
            } else{
                next()
            }
        }
        )
        
    }else{
        next()
    }
    
}

const isLogin=(req,res,next)=>{
    if(req.session.user){
        return res.redirect('/');
    }
    next()
}
module.exports={
    checkSession,
    isBlocked,
    isLogin
}