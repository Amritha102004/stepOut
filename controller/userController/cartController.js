const User = require("../../model/userModel")
const Product = require("../../model/productModel")
const Category = require("../../model/categoryModel")
const Cart = require("../../model/cartModel")
const Wishlist = require("../../model/wishlistModel")
const mongoose = require("mongoose")
const statusCode = require("../../utils/httpStatusCodes")


const maxQuantityPerProduct = 10

const loadCart = async (req, res) => {
  try {
    const user =req.session.user;
    const userId = req.session.user._id
    const cart = await Cart.findOne({ user: userId })
      .populate({
        path: "products.product",
        populate: {
          path: "categoryId",
          model: "Category",
        },
      })
      .lean()

    let cartItems = []
    let totalAmount = 0
    let totalItems = 0

    if (cart && cart.products.length > 0) {
      cartItems = cart.products.filter((item) => {
        const product = item.product
        if (!product || !product.isActive || product.isDeleted) {
          return false
        }
        if (!product.categoryId || !product.categoryId.isListed) {
          return false
        }

        const variant = product.variants.find((v) => v.size === item.size)
        if (!variant) {
          return false
        }

        item.variant = variant
        item.itemTotal = variant.salePrice * item.quantity
        item.isOutOfStock = variant.varientquantity === 0
        item.maxQuantity = Math.min(variant.varientquantity, maxQuantityPerProduct)

        if (!item.isOutOfStock) {
          totalAmount += item.itemTotal
          totalItems += item.quantity
        }

        return true
      })
    }

    res.render("user/cart", {
      user,
      cartItems,
      totalAmount,
      totalItems,
      hasOutOfStockItems: cartItems.some((item) => item.isOutOfStock),
    })
  } catch (error) {
    console.log("Error loading cart:", error)
    req.flash("error_msg", "Failed to load cart")
    res.status(statusCode.INTERNAL_SERVER_ERROR).redirect("/")
  }
}

const addToCart = async (req, res) => {
  try {
    const userId = req.session.user._id
    const { productId, size, quantity = 1 } = req.body

    if (!productId || !size) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Product ID and size are required",
      })
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Invalid product ID",
      })
    }

    const requestedQuantity = Number.parseInt(quantity)
    if (isNaN(requestedQuantity) || requestedQuantity < 1) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Invalid quantity",
      })
    }

    const product = await Product.findById(productId).populate("categoryId")

    if (!product || !product.isActive || product.isDeleted) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Product not found or unavailable",
      })
    }
    if (!product.categoryId || !product.categoryId.isListed) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Product category is not available",
      })
    }

    const variant = product.variants.find((v) => v.size === size)
    if (!variant) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Selected size is not available",
      })
    }

    if (variant.varientquantity === 0) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Product is out of stock",
      })
    }

    let cart = await Cart.findOne({ user: userId })
    if (!cart) {
      cart = new Cart({ user: userId, products: [] })
    }

    const existingItemIndex = cart.products.findIndex(
      (item) => item.product.toString() === productId && item.size === size,
    )

    let finalQuantity = requestedQuantity

    if (existingItemIndex > -1) {
      const currentQuantity = cart.products[existingItemIndex].quantity
      finalQuantity = currentQuantity + requestedQuantity
    }

    const maxAllowed = Math.min(variant.varientquantity, maxQuantityPerProduct)
    if (finalQuantity > maxAllowed) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: `Cannot add more than ${maxAllowed} items. ${variant.varientquantity < maxQuantityPerProduct ? "Limited stock available." : "Maximum quantity per product exceeded."}`,
      })
    }

    if (existingItemIndex > -1) {
      cart.products[existingItemIndex].quantity = finalQuantity
    } else {
      cart.products.push({
        product: productId,
        size: size,
        quantity: finalQuantity,
      })
    }

    await cart.save()

    try {
      await Wishlist.updateOne({ user: userId }, { $pull: { products: productId } })
    } catch (wishlistError) {
      console.log("Error removing from wishlist:", wishlistError)
    }

    res.status(statusCode.OK).json({
      success: true,
      message: existingItemIndex > -1 ? "Cart updated successfully" : "Product added to cart",
      cartItemCount: cart.products.reduce((total, item) => total + item.quantity, 0),
    })
  } catch (error) {
    console.log("Error adding to cart:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to add product to cart",
    })
  }
}

const updateCartQuantity = async (req, res) => {
  try {
    const userId = req.session.user._id
    const { productId, size, quantity } = req.body

    if (!productId || !size || quantity === undefined) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Product ID, size, and quantity are required",
      })
    }

    const newQuantity = Number.parseInt(quantity)
    if (isNaN(newQuantity) || newQuantity < 0) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Invalid quantity",
      })
    }

    const cart = await Cart.findOne({ user: userId })
    if (!cart) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Cart not found",
      })
    }

    const itemIndex = cart.products.findIndex((item) => item.product.toString() === productId && item.size === size)

    if (itemIndex === -1) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Item not found in cart",
      })
    }

    if (newQuantity === 0) {
      cart.products.splice(itemIndex, 1)
      await cart.save()

      return res.status(statusCode.OK).json({
        success: true,
        message: "Item removed from cart",
        cartItemCount: cart.products.reduce((total, item) => total + item.quantity, 0),
      })
    }

    const product = await Product.findById(productId)
    if (!product || !product.isActive || product.isDeleted) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Product not found or unavailable",
      })
    }

    const variant = product.variants.find((v) => v.size === size)
    if (!variant) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Selected size is not available",
      })
    }

    const maxAllowed = Math.min(variant.varientquantity, maxQuantityPerProduct)
    if (newQuantity > maxAllowed) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: `Cannot add more than ${maxAllowed} items`,
        maxQuantity: maxAllowed,
      })
    }

    cart.products[itemIndex].quantity = newQuantity
    await cart.save()

    res.status(statusCode.OK).json({
      success: true,
      message: "Cart updated successfully",
      cartItemCount: cart.products.reduce((total, item) => total + item.quantity, 0),
    })
  } catch (error) {
    console.log("Error updating cart quantity:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to update cart",
    })
  }
}

const removeFromCart = async (req, res) => {
  try {
    const userId = req.session.user._id
    const { productId, size } = req.params

    if (!productId || !size) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Product ID and size are required",
      })
    }

    const cart = await Cart.findOne({ user: userId })
    if (!cart) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Cart not found",
      })
    }

    const itemIndex = cart.products.findIndex((item) => item.product.toString() === productId && item.size === size)

    if (itemIndex === -1) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Item not found in cart",
      })
    }

    cart.products.splice(itemIndex, 1)
    await cart.save()

    res.status(statusCode.OK).json({
      success: true,
      message: "Item removed from cart",
      cartItemCount: cart.products.reduce((total, item) => total + item.quantity, 0),
    })
  } catch (error) {
    console.log("Error removing from cart:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to remove item from cart",
    })
  }
}

const clearCart = async (req, res) => {
  try {
    const userId = req.session.user._id

    const cart = await Cart.findOne({ user: userId })
    if (!cart) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Cart not found",
      })
    }

    cart.products = []
    await cart.save()

    res.status(statusCode.OK).json({
      success: true,
      message: "Cart cleared successfully",
      cartItemCount: 0,
    })
  } catch (error) {
    console.log("Error clearing cart:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to clear cart",
    })
  }
}

const getCartCount = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(statusCode.OK).json({
        cartItemCount: 0,
      })
    }

    const userId = req.session.user._id
    const cart = await Cart.findOne({ user: userId })

    const cartItemCount = cart ? cart.products.reduce((total, item) => total + item.quantity, 0) : 0

    res.status(statusCode.OK).json({
      cartItemCount,
    })
  } catch (error) {
    console.log("Error getting cart count:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to get cart count",
    })
  }
}

module.exports = {
  loadCart,
  addToCart,
  updateCartQuantity,
  removeFromCart,
  clearCart,
  getCartCount,
}
