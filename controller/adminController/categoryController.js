const User = require("../../model/userModel")
const Product = require("../../model/productModel")
const Category = require("../../model/categoryModel")

const loadCategory = async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1
    const limit = 3
    const skip = (page - 1) * limit
    const searchQuery = req.query.search || ""
    const sort = req.query.sort || "createdAt"
    const order = req.query.order || "desc"

    const filter = {}
    if (searchQuery) {
      filter.name = { $regex: searchQuery, $options: "i" }
    }

    const sortObj = {}
    sortObj[sort] = order === "asc" ? 1 : -1

    const totalCategories = await Category.countDocuments(filter)
    const totalPages = Math.ceil(totalCategories / limit)
    const categories = await Category.find(filter).sort(sortObj).skip(skip).limit(limit)

    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const productCount = await Product.countDocuments({ categoryId: category._id })
        return {
          ...category._doc,
          productCount,
        }
      }),
    )

    const admin = {
      name: req.session.admin.name,
      email: req.session.admin.email,
    }

    res.render("admin/category", {
      admin,
      categories: categoriesWithCounts,
      currentPage: page,
      totalPages,
      totalCategories,
      searchQuery,
      sort,
      order,
      limit,
    })
  } catch (error) {
    console.error(error)
    req.flash("error_msg", "Server error")
    res.status(500).render("admin/category", { error_msg: "Server Error" })
  }
}

const loadAddCategory = (req, res) => {
  const admin = {
    name: req.session.admin.name,
    email: req.session.admin.email,
  }

  res.render("admin/addCategory", { admin })
}

const addCategory = async (req, res) => {
  try {
    const { name, description, offer = 0,isDeleted = "false" } = req.body
    const existingCategory = await Category.findOne({ name })

    if (existingCategory) {
      req.flash("error_msg", "Category already exists")
      return res.render("admin/addCategory", {
        error_msg: "Category already exists",
        admin: {
          name: req.session.admin.name,
          email: req.session.admin.email,
        },
      })
    }

    const newCategory = new Category({
      name,
      description,
      offer: Number(offer),
      stock: 0, 
      isListed: isDeleted === "false",
    })

    await newCategory.save()
    req.flash("success_msg", "Category added successfully")
    res.redirect("/admin/category")
  } catch (error) {
    console.error(error)
    req.flash("error_msg", "Server error: " + error.message)
    res.status(500).render("admin/pages/adminAddCategory", {
      error_msg: "Server Error: " + error.message,
      admin: {
        name: req.session.admin.name,
        email: req.session.admin.email,
      },
    })
  }
}

const loadEditCategory = async (req, res) => {
  try {
    const categoryId = req.query.id
    const category = await Category.findById(categoryId)

    if (!category) {
      req.flash("error_msg", "Category not found")
      return res.redirect("/admin/category")
    }

    const admin = {
      name: req.session.admin.name,
      email: req.session.admin.email,
    }

    res.render("admin/editCategory", { admin, category })
  } catch (error) {
    console.error(error)
    req.flash("error_msg", "Server error")
    res.status(500).render("admin/editCategory", { error_msg: "Server error" })
  }
}

const editCategory = async (req, res) => {
  try {
    const categoryId = req.params.id
    const { name, description, offer, isDeleted } = req.body

    const category = await Category.findById(categoryId)
    if (!category) {
      req.flash("error_msg", "Category not found")
      return res.redirect("/admin/category")
    }

    const existingCategory = await Category.findOne({ name, _id: { $ne: categoryId } })
    if (existingCategory) {
      req.flash("error_msg", "Category name already exists")
      return res.render("admin/editCategory", {
        category,
        error_msg: "Category name already exists",
        admin: {
          name: req.session.admin.name,
          email: req.session.admin.email,
        },
      })
    }

    const oldOffer = category.offer
    const newOffer = Number(offer) || 0

    const updateData = {
      name,
      description,
      offer: newOffer,
      isListed: isDeleted === "false",
    }

    await Category.findByIdAndUpdate(categoryId, updateData, { new: true })

    if (oldOffer !== newOffer) {
      const products = await Product.find({ categoryId: categoryId })
      
      for (const product of products) {
        product.variants = product.variants.map(variant => {
          const originalPrice = variant.varientPrice
          const discount = (originalPrice * newOffer) / 100
          return {
            ...variant,
            salePrice: Math.round(originalPrice - discount)
          }
        })

        product.offer = newOffer
        
        await product.save()
      }
    }

    req.flash("success_msg", "Category updated successfully")
    res.redirect("/admin/category")
  } catch (error) {
    console.error(error)
    req.flash("error_msg", "Server error: " + error.message)
    res.status(500).render("admin/pages/adminEditCategory", { error_msg: "Server error: " + error.message })
  }
}

const deleteCategory = async (req, res) => {
  try {
    const categoryId = req.params.id

    const productsUsingCategory = await Product.countDocuments({ categoryId: categoryId })
    if (productsUsingCategory > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete category because it has associated products",
      })
    }

    await Category.findByIdAndDelete(categoryId)
    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, message: "Server error" })
  }
}

const toggleCategoryListing = async (req, res) => {
  try {
    const categoryId = req.params.id
    const category = await Category.findById(categoryId)

    if (!category) {
      req.flash("error_msg", "Category not found")
      return res.redirect("/admin/category")
    }

    const newListingStatus = !category.isListed
    category.isListed = newListingStatus
    await category.save()

    await Product.updateMany(
      { categoryId: categoryId },
      { isActive: newListingStatus }
    )

    req.flash("success_msg", `Category ${category.isListed ? "listed" : "unlisted"} successfully`)
    res.redirect("/admin/category")
  } catch (error) {
    console.error(error)
    req.flash("error_msg", "Server error")
    res.redirect("/admin/category")
  }
}

module.exports = {
  loadCategory,
  loadAddCategory,
  addCategory,
  loadEditCategory,
  editCategory,
  deleteCategory,
  toggleCategoryListing,
}
