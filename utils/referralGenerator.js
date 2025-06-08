const User = require("../model/userModel")

const generateReferralCode = async (fullName) => {
  // Create base code from name + random numbers
  const namePrefix = fullName.replace(/\s+/g, "").substring(0, 4).toUpperCase()
  let referralCode
  let isUnique = false
  let attempts = 0

  while (!isUnique && attempts < 5) {
    const randomNum = Math.floor(1000 + Math.random() * 9000) // 4-digit number
    referralCode = `${namePrefix}${randomNum}`

    // Check if code already exists
    const existingUser = await User.findOne({ referralCode })
    if (!existingUser) {
      isUnique = true
    }
    attempts++
  }

  // Fallback if name-based generation fails
  if (!isUnique) {
    const timestamp = Date.now().toString().slice(-6)
    referralCode = `REF${timestamp}`
  }

  return referralCode
}

const validateReferralCode = async (code) => {
  if (!code || code.trim() === "") {
    return { valid: false, message: "Referral code is empty" }
  }

  const referrer = await User.findOne({ referralCode: code.trim().toUpperCase() })
  if (!referrer) {
    return { valid: false, message: "Invalid referral code" }
  }

  return { valid: true, referrer }
}

module.exports = {
  generateReferralCode,
  validateReferralCode,
}
