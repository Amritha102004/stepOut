const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../../model/orderModel');
const Cart = require('../../model/cartModel');
const Product = require('../../model/productModel');
const Address = require('../../model/addressModel');
const statusCode = require('../../utils/httpStatusCodes');


const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const createOrder = async (req, res) => {
  try {
    const { addressId, paymentMethod, couponId } = req.body;
    const userId = req.session.user._id;

    const address = await Address.findOne({ _id: addressId, user: userId });
    if (!address) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Invalid delivery address"
      });
    }

    const cart = await Cart.findOne({ user: userId }).populate({
      path: "products.product",
      populate: {
        path: "categoryId",
        model: "Category"
      }
    });

    if (!cart || cart.products.length === 0) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Your cart is empty"
      });
    }

    let totalAmount = 0;
    let discount = 0;
    const orderProducts = [];

    for (const item of cart.products) {
      const product = item.product;
      if (!product || !product.isActive || product.isDeleted) {
        continue;
      }

      const variant = product.variants.find(v => v.size === item.size);
      if (!variant) {
        continue;
      }

      if (variant.varientquantity < item.quantity) {
        return res.status(statusCode.BAD_REQUEST).json({
          success: false,
          message: `Only ${variant.varientquantity} units of ${product.name} (${item.size}) are available`
        });
      }

      const itemTotal = variant.salePrice * item.quantity;
      totalAmount += itemTotal;

      orderProducts.push({
        product: product._id,
        variant: {
          size: item.size,
          varientPrice: variant.varientPrice,
          salePrice: variant.salePrice
        },
        quantity: item.quantity,
        status: 'pending'
      });

      variant.varientquantity -= item.quantity;
      await product.save();
    }

    let coupon = null;
    if (couponId) {
      coupon = await Coupon.findById(couponId);
      if (coupon && coupon.isActive) {
        const now = new Date();
        if (coupon.startDate <= now && coupon.expiryDate >= now && totalAmount >= coupon.minOrderAmount) {
          if (coupon.discountType === 'percentage') {
            discount = Math.min((totalAmount * coupon.discountValue) / 100, coupon.maxDiscountValue || Infinity);
          } else {
            discount = coupon.discountValue;
          }
        }
      }
    }
    const finalAmount = totalAmount - discount;

    const order = new Order({
      user: userId,
      products: orderProducts,
      address: addressId,
      totalAmount,
      discount,
      finalAmount,
      paymentMethod,
      orderStatus: 'pending',
      coupon: couponId || null
    });
    await order.save();
    if (paymentMethod === 'COD') {
      cart.products = [];
      await cart.save();

      return res.status(statusCode.OK).json({
        success: true,
        message: "Order placed successfully",
        orderId: order._id,
        paymentMethod: 'COD'
      });
    }
    const razorpayOrder = await razorpay.orders.create({
      amount: finalAmount * 100, // Amount in paise
      currency: 'INR',
      receipt: order._id.toString(),
      notes: {
        orderId: order._id.toString(),
        userId: userId.toString()
      }
    });

    res.status(statusCode.OK).json({
      success: true,
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency
      },
      orderId: order._id,
      paymentMethod: 'online'
    });

  } catch (error) {
    console.log("Error creating order:", error);
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to create order"
    });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;
    
    // Verify signature
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');
    
    if (generatedSignature !== razorpay_signature) {
      await Order.findByIdAndUpdate(orderId, { orderStatus: 'payment failed' });
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Payment verification failed"
      });
    }
    
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Order not found"
      });
    }
    
    order.orderStatus = 'confirmed';
    await order.save();
    
    await Cart.findOneAndUpdate(
      { user: req.session.user._id },
      { $set: { products: [] } }
    );
    
    res.status(statusCode.OK).json({
      success: true,
      message: "Payment verified successfully",
      orderId
    });
    
  } catch (error) {
    console.log("Error verifying payment:", error);
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to verify payment"
    });
  }
};

const handlePaymentFailure = async (req, res) => {
  try {
    const { orderId, error } = req.body;
    
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Order not found"
      });
    }

    order.orderStatus = 'payment failed';
    await order.save();
    
    for (const item of order.products) {
      const product = await Product.findById(item.product);
      if (product) {
        const variantIndex = product.variants.findIndex(v => v.size === item.variant.size);
        if (variantIndex !== -1) {
          product.variants[variantIndex].varientquantity += item.quantity;
          await product.save();
        }
      }
    }
    
    res.status(statusCode.OK).json({
      success: true,
      message: "Payment failure handled",
      orderId,
      error
    });
    
  } catch (error) {
    console.log("Error handling payment failure:", error);
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to handle payment failure"
    });
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  handlePaymentFailure
};