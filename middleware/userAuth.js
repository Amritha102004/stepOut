const checkSession=(req,res,next)=>{
    if(req.session.user){
        return next()
    }
    res.render('user/login',{error:"please login or signup"}); 
}

module.exports={checkSession,}