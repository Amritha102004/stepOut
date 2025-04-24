
const mongoose = require('mongoose');
const {Schema}=mongoose;

const productSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    brand: {
      // type: mongoose.Schema.Types.ObjectId,
      type: String,
      // ref: 'Brand', 
      required: true,
    },
    offer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Offer', 
    },
    images: {
      type: [String],
      required: true,
    },
    variants: [
      {
        size: {
          type: String,
          required: true,
        },
        regular_price: {
          type: Number,
          required: true,
        },
        stock: {
          type: Number,
          required: true,
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  }
);

module.exports = mongoose.model('Product', productSchema);
