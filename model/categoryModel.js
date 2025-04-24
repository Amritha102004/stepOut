// models/Category.js
const mongoose = require('mongoose');
const {Schema}=mongoose;

const categorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    offer: {
      type: Number, 
      default: 0,
    },
    description: {
      type: String,
      required: true,
    },
    isListed: {
      type: Boolean,
      default: true,
    },
  }
);

module.exports = mongoose.model('Category', categorySchema);
