const checkSession=(req,res,next)=>{
    if(req.session.admin){
        return next()
    }
    res.render('admin/login',{error:"session expired! please login"});
}


const isAdmin = (req, res, next) => {
    if (req.session.admin?.isAdmin) {
      return next();
    }
    res.render('admin/login', { error: 'Unauthorized: Admins only' });
  };
  

module.exports={
    checkSession,
    isAdmin
}