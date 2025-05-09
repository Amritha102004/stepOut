let Customer = require('../../model/userModel')
const statusCode = require("../../utils/httpStatusCodes")

const loadCustomer = async (req, res) => {
    try {

        const page = parseInt(req.query.page) || 1
        const limit = 10
        const skip = (page - 1) * limit
        const searchQuery = req.query.search || ""

        const filter = {}
        if (searchQuery) {
            filter.fullName = { $regex: "^"+searchQuery, $options: "i" }
        }
        
        const totalCustomers = await Customer.countDocuments(filter)
        const totalPages = Math.ceil(totalCustomers / limit)
        const customers = await Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)
    

        res.render('admin/customer', {  
            customers,
            currentPage: page,
            totalPages,
            searchQuery,
        })


    } catch (error) {
        // res.redirect('/user/error404')
        res.status(statusCode.INTERNAL_SERVER_ERROR).send(error);
    }
}

const block=async (req,res)=>{
    try {
        const customerId = req.params.id;
        const customer = await Customer.findById(customerId);
        
        if (!customer) {
            return res.status(statusCode.NOT_FOUND).json({ success: false, message: "customer not found" });
        }

        customer.isBlocked=!customer.isBlocked
        await customer.save()
        return res.status(statusCode.OK).json({
            success: true,
            message: customer.isBlocked ? "Customer Blocked successfully" : "Customer unBlocked successfully",
            isBlocked: customer.isBlocked,
        });
        
    } catch (error) {
        console.error(`Error toggling customer blocking: ${error.message}`);
        res.status(statusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: "Server error" });
    }
}

module.exports = {
    loadCustomer,
    block,
}