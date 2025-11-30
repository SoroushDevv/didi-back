const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("./../db/DidikalaDB"); 
require("dotenv").config();

const usersRouter = express.Router();

// 📌 JWT authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Authentication token required" });

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    next();
  } catch {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

usersRouter.post("/register", async (req, res) => {
  const { username, password, phone, email, firstname, lastname, city, address, role } = req.body;

  if (!username || !password || !phone || !email)
    return res.status(400).json({ message: "username, password, phone, and email are required" });

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ message: "Invalid email format" });

  try {
    const [existingUsers] = await pool.query(
      "SELECT * FROM users WHERE username = ? OR email = ?",
      [username.trim(), email.trim()]
    );
    if (existingUsers.length > 0)
      return res.status(400).json({ message: "username or email already exists" });

    const hashedPassword = await bcrypt.hash(password.trim(), 10);

    const token = jwt.sign({ username: username.trim() }, process.env.JWT_SECRET, { expiresIn: "30d" });

    await pool.query(
      `INSERT INTO users (firstname, lastname, username, password, phone, city, email, address, score, buy, token, role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ? )`,
      [
        firstname?.trim() || null,
        lastname?.trim() || null,
        username.trim(),
        hashedPassword,
        phone,
        city?.trim() || null,
        email.trim(),
        address?.trim() || null,
        token,
        role?.trim() || "user",
      ]
    );

    res.status(201).json({ message: "user registered successfully", token });
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).json({ message: "Database error", details: err.message });
  }
});

// 📌 Get all users
usersRouter.get("/", async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT id, firstname, lastname, username, phone, city, email, address, score, buy, role, token FROM users`
    );
    res.status(200).json(users);
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).json({ message: "Database error", details: err.message });
  }
});

// 📌 Delete user
usersRouter.delete("/:userID", authenticateToken, async (req, res) => {
  try {
    const userID = req.params.userID;
    const [result] = await pool.query("DELETE FROM users WHERE id = ?", [userID]);
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "user not found" });

    res.status(200).json({ message: "user deleted successfully" });
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).json({ message: "Database error", details: err.message });
  }
});

// 📌 Update user
usersRouter.put("/:userID", authenticateToken, async (req, res) => {
  try {
    const userID = req.params.userID;
    const { firstname, lastname, username, password, phone, city, email, address, score, buy, role } = req.body;

    if (username && username.trim() === "")
      return res.status(400).json({ message: "username cannot be empty" });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ message: "Invalid email format" });
    if (role && !["admin", "user"].includes(role.trim()))
      return res.status(400).json({ message: "Invalid role" });

    const hashedPassword = password ? await bcrypt.hash(password.trim(), 10) : null;

    const [result] = await pool.query(
      `UPDATE users 
       SET firstname = ?, lastname = ?, username = ?, password = ?, phone = ?, city = ?, email = ?, address = ?, score = ?, buy = ?, role = ?
       WHERE id = ?`,
      [
        firstname?.trim() || null,
        lastname?.trim() || null,
        username?.trim() || null,
        hashedPassword || null,
        phone || null,
        city?.trim() || null,
        email?.trim() || null,
        address?.trim() || null,
        score ?? 0,
        buy ?? 0,
        role?.trim() || "user",
        userID,
      ]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "user not found" });

    res.status(200).json({ message: "user updated successfully" });
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).json({ message: "Database error", details: err.message });
  }
});

// 📌 Partial user update (PATCH)
usersRouter.patch("/:userID", authenticateToken, async (req, res) => {
  try {
    const userID = req.params.userID;
    const fields = req.body;

    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ message: "No fields provided for update" });
    }

    const allowedFields = ["firstname", "lastname", "username", "password", "phone", "city", "email", "address", "score", "buy", "role"];
    const updates = [];
    const values = [];

    for (const [key, value] of Object.entries(fields)) {
      if (!allowedFields.includes(key)) continue;

      if (key === "password") {
        const hashedPassword = await bcrypt.hash(value.trim(), 10);
        updates.push(`${key} = ?`);
        values.push(hashedPassword);
      } else {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: "No valid fields provided" });
    }

    const sql = `UPDATE users SET ${updates.join(", ")} WHERE id = ?`;
    values.push(userID);

    const [result] = await pool.query(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "user not found" });
    }

    res.status(200).json({ message: "user updated successfully" });
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).json({ message: "Database error", details: err.message });
  }
});

// 📌 Change user password
usersRouter.put("/:userID/password", authenticateToken, async (req, res) => {
  try {
    const requester = req.user;
    const targetUserID = parseInt(req.params.userID, 10);
    const { currentPassword, newPassword } = req.body;

    if (isNaN(targetUserID)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    const [userRows] = await pool.query("SELECT id, password, username, role FROM users WHERE id = ?", [targetUserID]);
    if (!userRows.length) {
      return res.status(404).json({ error: "user not found" });
    }
    const targetUser = userRows[0];

    if (requester.role === "user" && requester.id !== targetUserID) {
      return res.status(403).json({ error: "users can only change their own password" });
    }

    if (requester.role === "admin" && targetUser.role === "admin" && requester.id !== targetUserID) {
      return res.status(403).json({ error: "Admin cannot change another admin's password" });
    }

    if (requester.role === "user" || (requester.role === "admin" && requester.id === targetUserID)) {
      if (!currentPassword) {
        return res.status(400).json({ error: "Current password is required" });
      }
      const passwordMatches = await bcrypt.compare(currentPassword, targetUser.password);
      if (!passwordMatches) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    const [result] = await pool.query("UPDATE users SET password = ? WHERE id = ?", [hashed, targetUserID]);

    if (result.affectedRows === 0) {
      return res.status(500).json({ error: "Password update failed" });
    }

    res.status(200).json({ message: "Password changed successfully" });

  } catch (err) {
    console.error("Error changing password:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 📌 User login
usersRouter.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: "username and password required" });

  try {
    const [rows] = await pool.query("SELECT * FROM users WHERE username = ?", [username]);
    if (!rows.length) return res.status(401).json({ message: "Incorrect username or password" });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Incorrect username or password" });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "30d" });
    await pool.query("UPDATE users SET token = ? WHERE id = ?", [token, user.id]);

    res.status(200).json({ user, token });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = usersRouter;
