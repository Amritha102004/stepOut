const checkSession=(req,res,next)=>{
    if(req.session.admin){
        return next()
    }
    res.render('admin/login',{error:"session expired! please login"});
}




module.exports={
    checkSession,
}