const mongoose = require('mongoose');
const {Schema}=mongoose;

const userSchema = new Schema(
  {
    fullName: {
      type: String, 
      required: true,
      trim:true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase:true,
    },
    phoneNumber: {
      type: String,
      required: false,
      unique: false,
      sparse: true,
      default: null,
    },
    googleId: {
      type: String,
      unique: true,
      sparse:true,
    },
    password: {
      type: String,
      required:  function() {
        return !this.googleId;
      }

    }, 
    image: {
      type: [String],
      default:[], 
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('User', userSchema);
