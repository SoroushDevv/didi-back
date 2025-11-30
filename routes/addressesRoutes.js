const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("./../db/DidikalaDB");

const addressesRouter = express.Router();

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Authentication token required" });

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
    req.user = user;
    next();
  } catch {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

// GET: دریافت همه آدرس‌های کاربر
addressesRouter.get("/", authenticateToken, async (req, res) => {
  try {
    const userID = req.user.id;
    const [result] = await pool.query(
      `SELECT id, user_id AS userID, province, address, city, postal_code AS postalCode, address_type AS addressType, created_at AS createdAt
       FROM addresses WHERE user_id = ?`,
      [userID]
    );
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ message: "Database error", details: err.message });
  }
});

// POST: افزودن آدرس جدید
addressesRouter.post("/", authenticateToken, async (req, res) => {
  try {
    const { province, address, city, postalCode, addressType } = req.body;
    if (!province || !address || !city || !postalCode || !["HOME","WORK","OTHER"].includes(addressType)) {
      return res.status(400).json({ message: "Invalid input" });
    }
    if (!/^\d{10}$/.test(postalCode)) {
      return res.status(400).json({ message: "Postal code must be 10 digits" });
    }

    const userID = req.user.id;
    const [result] = await pool.query(
      `INSERT INTO addresses (user_id, province, address, city, postal_code, address_type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userID, province.trim(), address.trim(), city.trim(), postalCode, addressType]
    );

    res.status(201).json({ message: "address added successfully", addressID: result.insertId });
  } catch (err) {
    res.status(500).json({ message: "Database error", details: err.message });
  }
});

// PUT: ویرایش آدرس
addressesRouter.put("/:addressID", authenticateToken, async (req, res) => {
  try {
    const addressID = parseInt(req.params.addressID);
    const { province, address, city, postalCode, addressType } = req.body;

    if (isNaN(addressID)) return res.status(400).json({ message: "Invalid addressID" });
    if (!province || !address || !city || !postalCode || !["HOME","WORK","OTHER"].includes(addressType)) {
      return res.status(400).json({ message: "Invalid input" });
    }
    if (!/^\d{10}$/.test(postalCode)) return res.status(400).json({ message: "Postal code must be 10 digits" });

    const userID = req.user.id;
    const [result] = await pool.query(
      `UPDATE addresses SET province = ?, address = ?, city = ?, postal_code = ?, address_type = ? WHERE id = ? AND user_id = ?`,
      [province.trim(), address.trim(), city.trim(), postalCode, addressType, addressID, userID]
    );

    if (result.affectedRows === 0) return res.status(404).json({ message: "address not found or not yours" });

    res.status(200).json({ message: "address updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Database error", details: err.message });
  }
});

// DELETE: حذف آدرس
addressesRouter.delete("/:addressID", authenticateToken, async (req, res) => {
  try {
    const addressID = parseInt(req.params.addressID);
    if (isNaN(addressID)) return res.status(400).json({ message: "Invalid addressID" });

    const userID = req.user.id;
    const [result] = await pool.query(
      `DELETE FROM addresses WHERE id = ? AND user_id = ?`,
      [addressID, userID]
    );

    if (result.affectedRows === 0) return res.status(404).json({ message: "address not found or not yours" });

    res.status(200).json({ message: "address deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Database error", details: err.message });
  }
});

module.exports = addressesRouter;
