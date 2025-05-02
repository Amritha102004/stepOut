let customer = require('../../model/userModel')



const loadCustomer = async (req, res) => {
    try {
        
            const page = parseInt(req.query.page) || 1
            const limit = 10
            const skip = (page - 1) * limit

            const customers = await customer.find().skip(skip).limit(limit)
            const totalCustomers = await customer.countDocuments()
            const totalPages = Math.ceil(totalCustomers / limit)

            res.render('admin/customer', {
                customers,
                currentPage: page,
                totalPages,
            })
        

    } catch (error) {
        // res.redirect('/user/error404')
        res.send(error);
    }
}

module.exports = {
    loadCustomer,
}