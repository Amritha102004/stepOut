const mongoose = require('mongoose');
const { Schema } = mongoose;

const variantSchema = new Schema({
  size: {
    type: String,
    required: true
  },
  varientPrice: {
    type: Number,
    required: true
  },
  salePrice: {
    type: Number,
    required: true
  },
  varientquantity: {
    type: Number,
    required: true
  }
});

const imageSchema = new Schema({
  url: {
    type: String,
    required: true
  },
  thumbnail: {
    type: String,
    required: true
  },
  isMain: {
    type: Boolean,
    default: false
  }
});

const productSchema = new Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    auto: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  categoryId: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  brand: {
    type: String,
    required: false
  },
  color : {
    type: String,
    required: true
  },
  offer: {
    type: Number,
    required: true
  },
  images: [imageSchema],
  variants: [variantSchema],
  sku: {
    type: String,
    required: false,
    unique: true
  },
  tags: [{
    type: String
  }],
  ratings: {
    average: {
      type: Number,
      default: 0
    },
    count: {
      type: Number,
      default: 0
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
},
  {
    timestamps: true,
  }
);

// productSchema.pre('save', function (next) {
//   this.updatedAt = Date.now();
//   next();
// });

module.exports = mongoose.model('Product', productSchema);

