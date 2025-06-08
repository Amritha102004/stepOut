const User = require("../../model/userModel")
const Wallet = require("../../model/walletModel")
const statusCode = require("../../utils/httpStatusCodes")

const loadReferral = async (req, res) => {
  try {
    const user = req.session.user
    const userId = user._id

    const totalReferrals = await User.countDocuments({ referredBy: user.referralCode })

    let wallet = await Wallet.findOne({ userId })
    if (!wallet) {
      wallet = { balance: 0, transactions: [] }
    }

    const referralTransactions =
      wallet.transactions?.filter((t) => t.reason && t.reason.includes("Referral bonus")) || []

    const totalEarnings = referralTransactions.reduce((sum, t) => sum + t.amount, 0)

    const referralStats = {
      totalReferrals,
      totalEarnings,
    }

    res.render("user/referral", {
      user,
      wallet,
      referralStats,
      activePage: "referral",
    })
  } catch (error) {
    console.log("Error loading referral page:", error)
    req.flash("error_msg", "Failed to load referral page")
    res.status(statusCode.INTERNAL_SERVER_ERROR).redirect("/account")
  }
}

const getReferralStats = async (req, res) => {
  try {
    const user = req.session.user
    const totalReferrals = await User.countDocuments({ referredBy: user.referralCode })

    res.status(statusCode.OK).json({
      success: true,
      totalReferrals,
    })
  } catch (error) {
    console.log("Error getting referral stats:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to get referral stats",
    })
  }
}

module.exports = {
  loadReferral,
  getReferralStats,
}
