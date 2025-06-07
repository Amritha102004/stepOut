const User = require('../../model/userModel');
const Address = require('../../model/addressModel');
const statusCode = require("../../utils/httpStatusCodes");


const loadAddresses = async (req, res) => {
    try {
        const user=req.session.user;
        const addresses = await Address.find({ user: user._id }).sort({ isDefault: -1, createdAt: -1 });

        if (!addresses) {
            return res.render('user/addresses', { addresses: [], user })
        }
        res.render('user/addresses', { addresses, user})
    } catch (error) {
        console.log(error)
        res.status(statusCode.INTERNAL_SERVER_ERROR).send("cannot load address page")
    }
}

const addAddress = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { name, mobile, address, pincode, city, state, isDefault } = req.body;

        const errors = {};
        const nameRegex = /^[A-Za-z\s]{3,}$/;
        if (!name) {
            errors.name = "Name is required";
        } else if (!nameRegex.test(name)) {
            errors.name = "Enter a valid full name (only letters, min 3 chars)";
        }

        const phoneRegex = /^\d{10}$/;
        if (!mobile) {
            errors.mobile = "Phone number is required";
        } else if (!phoneRegex.test(mobile)) {
            errors.mobile = "Enter a valid 10-digit phone number";
        }

        const addressRegex = /^[\w\s,.-]{3,100}$/;
        if (!address) {
            errors.address = "Address is required";
        } else if (!addressRegex.test(address)) {
            errors.address = "enter valid address"
        }

        const pincodeRegex = /^\d{6}$/;
        if (!pincode) {
            errors.pincode = "Pincode is required";
        } else if (!pincodeRegex.test(pincode)) {
            errors.pincode = "Enter a valid 6-digit pincode";
        }

        const placeRegex = /^[A-Za-z\s]{2,50}$/;
        if (!city) {
            errors.city = "City is required";
        } else if (!placeRegex.test(city)) {
            errors.city = "Enter a valid city";
        }
        if (!state) {
            errors.state = "State is required";
        } else if (!placeRegex.test(state)) {
            errors.state = "Enter a valid state";
        }

        if (Object.keys(errors).length > 0) {
            return res.status(statusCode.BAD_REQUEST).json({
                success: false,
                errors,
            });
        }


        if (isDefault === 'on') {
            await Address.updateMany({ user: userId }, { isDefault: false });
            const newAddress = new Address({
                user: userId,
                name: name,
                mobile: mobile,
                pincode: pincode,
                address: address,
                city: city,
                state: state,
                isDefault: true
            })
            await newAddress.save();
            return res.status(statusCode.OK).json({
                success: true,
                message: "Address successfully added"
            })
        }

        const newAddress = new Address({
            user: userId,
            name: name,
            mobile: mobile,
            pincode: pincode,
            address: address,
            city: city,
            state: state,
        })
        await newAddress.save();
        res.status(statusCode.OK).json({
            success: true,
            message: "Address successfully added"
        })

    } catch (error) {
        console.log(error)
        res.status(statusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: "error adding the address" })
    }
}

const loadEdit = async (req, res) => {
    try {
        const addressId = req.params.addressId;
        const address = await Address.findOne({ _id: addressId });

        if (!address) {
            return res.status(statusCode.NOT_FOUND).json({success:false, message: "Address not found" });
        }
        
        res.status(statusCode.OK).json(address);

    } catch (error) {
        console.log(error)
        res.status(statusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: "error fetching address" })
    }
}

const editAddress = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { name, mobile, address, pincode, city, state, isDefault, addressId } = req.body;

        const errors = {};
        const nameRegex = /^[A-Za-z\s]{3,}$/;
        if (!name) {
            errors.name = "Name is required";
        } else if (!nameRegex.test(name)) {
            errors.name = "Enter a valid full name (only letters, min 3 chars)";
        }

        const phoneRegex = /^\d{10}$/;
        if (!mobile) {
            errors.mobile = "Phone number is required";
        } else if (!phoneRegex.test(mobile)) {
            errors.mobile = "Enter a valid 10-digit phone number";
        }

        const addressRegex = /^[\w\s,.-]{3,100}$/;
        if (!address) {
            errors.address = "Address is required";
        } else if (!addressRegex.test(address)) {
            errors.address = "enter valid address"
        }

        const pincodeRegex = /^\d{6}$/;
        if (!pincode) {
            errors.pincode = "Pincode is required";
        } else if (!pincodeRegex.test(pincode)) {
            errors.pincode = "Enter a valid 6-digit pincode";
        }

        const placeRegex = /^[A-Za-z\s]{2,50}$/;
        if (!city) {
            errors.city = "City is required";
        } else if (!placeRegex.test(city)) {
            errors.city = "Enter a valid city";
        }
        if (!state) {
            errors.state = "State is required";
        } else if (!placeRegex.test(state)) {
            errors.state = "Enter a valid state";
        }

        if (Object.keys(errors).length > 0) {
            return res.status(statusCode.BAD_REQUEST).json({
                success: false,
                errors,
            });
        }


        const findAddress = await Address.findById(addressId);
        if (isDefault === 'on' && findAddress.isDefault === false) {
            await Address.updateMany({ user: userId }, { isDefault: false });
            await Address.findByIdAndUpdate(addressId, {
                user: userId,
                name: name,
                mobile: mobile,
                pincode: pincode,
                address: address,
                city: city,
                state: state,
                isDefault: true
            })
            return res.status(statusCode.OK).json({
                success: true,
                message: "Address successfully edited"
            })
        }

        await Address.findByIdAndUpdate(addressId, {
            user: userId,
            name: name,
            mobile: mobile,
            pincode: pincode,
            address: address,
            city: city,
            state: state,
        })
        res.status(statusCode.OK).json({
            success: true,
            message: "Address successfully edited"
        })

    } catch (error) {
        console.log(error)
        res.status(statusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: "error editing the address" })
    }
}

const deleteAddress = async (req, res) => {
    try {
        const addressId = req.params.addressId;
        await Address.findOneAndDelete({ _id: addressId });
        res.status(statusCode.OK).json({
            success: true,
            message: "Address successfully deleted"
        })
    } catch (error) {
        console.log(error)
        res.status(statusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: "error deleting the address" })
    }
}



module.exports = {
    loadAddresses,
    addAddress,
    loadEdit,
    editAddress,
    deleteAddress
}