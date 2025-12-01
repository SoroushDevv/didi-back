const express = require("express");
const router = express.Router();
const pool = require("./../db/DidikalaDB");

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM user_profiles");
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: "Database error", details: err.message });
  }
});

router.get("/:user_id", async (req, res) => {
  const { user_id } = req.params;
  try {
    const [rows] = await pool.query("SELECT * FROM user_profiles WHERE user_id = ?", [user_id]);
    if (rows.length === 0) return res.status(404).json({ error: "Profile not found" });
    res.status(200).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Database error", details: err.message });
  }
});

router.post("/", async (req, res) => {
  const { user_id, profile_image } = req.body;
  try {
    const [result] = await pool.query(
      "INSERT INTO user_profiles (user_id, profile_image) VALUES (?, ?)",
      [user_id, profile_image]
    );
    res.status(201).json({ id: result.insertId, user_id, profile_image });
  } catch (err) {
    res.status(500).json({ error: "Database error", details: err.message });
  }
});

router.put("/:user_id", async (req, res) => {
  const { user_id } = req.params;
  const { profile_image } = req.body;
  try {
    const [result] = await pool.query(
      "UPDATE user_profiles SET profile_image = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
      [profile_image, user_id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "Profile not found" });
    res.status(200).json({ message: "Profile updated", user_id, profile_image });
  } catch (err) {
    res.status(500).json({ error: "Database error", details: err.message });
  }
});

router.delete("/:user_id", async (req, res) => {
  const { user_id } = req.params;
  try {
    const [result] = await pool.query("DELETE FROM user_profiles WHERE user_id = ?", [user_id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Profile not found" });
    res.status(200).json({ message: "Profile deleted" });
  } catch (err) {
    res.status(500).json({ error: "Database error", details: err.message });
  }
});

module.exports = router;
