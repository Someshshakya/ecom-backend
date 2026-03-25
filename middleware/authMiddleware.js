const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      res.status(401);
      throw new Error("Not authorized, missing token");
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(500);
      throw new Error("Server misconfiguration: JWT_SECRET missing");
    }

    const decoded = jwt.verify(token, secret);
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      res.status(401);
      throw new Error("Not authorized, user not found");
    }

    next();
  } catch (err) {
    res.status(res.statusCode && res.statusCode !== 200 ? res.statusCode : 401);
    next(err);
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401);
      return next(new Error("Not authorized"));
    }
    if (!roles.includes(req.user.role)) {
      res.status(403);
      return next(new Error("Forbidden"));
    }
    next();
  };
}

function vendorApproved(req, res, next) {
  if (!req.user) {
    res.status(401);
    return next(new Error("Not authorized"));
  }
  if (req.user.role !== "vendor") {
    res.status(403);
    return next(new Error("Vendor access only"));
  }
  const status = req.user.vendorDetails?.approvalStatus;
  if (status !== "approved") {
    res.status(403);
    return next(new Error("Vendor is not approved"));
  }
  next();
}

module.exports = { protect, authorize, vendorApproved };

