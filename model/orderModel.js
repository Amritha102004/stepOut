const mongoose = require('mongoose');
const { Schema } = mongoose;

const orderSchema = new Schema(
  {
    orderID: {
      type: String,
      required: true,
      unique: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    products: [
      {
        product: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        variant: {
          size: String,
          varientPrice: Number,
          salePrice: Number,
        },
        quantity: {
          type: Number,
          required: true,
        },
        status: {
          type: String,
          enum: [
            "pending",
            "confirmed",
            "shipped",
            "out for delivery",
            "delivered",
            "cancelled",
            "returned",
            "return_requested",
          ],
          default: "pending",
        },
        cancellationReason: String,
        cancelledAt: Date,
        returnReason: String,
        returnRequestDate: Date,
        returnApprovedAt: Date,
        returnRejectedAt: Date,
        returnApprovalReason: String,
        returnRejectionReason: String,
        trackingNumber: String,
        trackingUrl: String,
        refundAmount: Number,
        refundProcessedAt: Date,
      },
    ],
    address: {
      type: Schema.Types.ObjectId,
      ref: "Address",
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
    },
    finalAmount: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["COD", "online", "wallet", "partial-wallet"],
      required: true,
    },
    orderStatus: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "shipped",
        "out for delivery",
        "delivered",
        "cancelled",
        "returned",
        "return_requested",
      ],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded", "partial"],
      default: "pending",
    },
    orderDate: {
      type: Date,
      default: Date.now,
    },
    deliveredAt: Date,
    cancelledAt: Date,
    cancellationReason: String,
    returnRequestedAt: Date,
    returnReason: String,
    returnApprovedAt: Date,
    returnRejectedAt: Date,
    returnApprovalReason: String,
    returnRejectionReason: String,

    // Enhanced payment tracking
    paymentDetails: {
      razorpayOrderId: String,
      razorpayPaymentId: String,
      razorpaySignature: String,
      failureReason: String,
      retryCount: { type: Number, default: 0 },
    },

    // Enhanced refund tracking
    refundStatus: {
      type: String,
      enum: ["none", "pending", "partial", "completed", "failed"],
      default: "none",
    },
    refundAmount: { type: Number, default: 0 },
    refundMethod: {
      type: String,
      enum: ["wallet", "original", "bank"],
      default: "wallet",
    },
    refundProcessedAt: Date,
    refundReason: String,

    // Wallet integration
    walletAmountUsed: { type: Number, default: 0 },
    remainingAmount: { type: Number, default: 0 },

    trackingDetails: {
      courier: String,
      trackingNumber: String,
      trackingUrl: String,
      estimatedDelivery: Date,
      updates: [
        {
          status: String,
          location: String,
          timestamp: Date,
          description: String,
        },
      ],
    },
    coupon: {
      type: Schema.Types.ObjectId,
      ref: "Coupon",
      default: null,
    },
  },
  {
    timestamps: true,
  },
)

orderSchema.pre("save", async function (next) {
  if (this.isNew && !this.orderID) {
    const date = new Date()
    const year = date.getFullYear().toString().slice(-2)
    const month = ("0" + (date.getMonth() + 1)).slice(-2)
    const day = ("0" + date.getDate()).slice(-2)
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0")
    this.orderID = `ORD${year}${month}${day}${random}`
  }
  next()
})

module.exports = mongoose.model("Order", orderSchema)
