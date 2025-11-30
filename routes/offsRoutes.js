const express = require("express");
const pool = require("./../db/DidikalaDB");

const offsRouter = express.Router();

// دریافت تمام تخفیف‌ها
offsRouter.get("/", async (req, res) => {
  try {
    const [result] = await pool.query("SELECT id, code, date, endDate, isActive, percent, adminID FROM Offs");

    const formattedResult = result.map((off) => ({
      id: Number(off.id),
      code: off.code,
      date: off.date,
      endDate: off.endDate,
      isActive: Boolean(off.isActive),
      percent: Number(off.percent),
      adminID: Number(off.adminID),
    }));

    res.status(200).json(formattedResult);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch offs", details: err.message });
  }
});

// حذف تخفیف
offsRouter.delete("/:offID", async (req, res) => {
  try {
    const offID = parseInt(req.params.offID);
    if (isNaN(offID)) return res.status(400).json({ message: "Invalid offID" });

    const [result] = await pool.query("DELETE FROM Offs WHERE id = ?", [offID]);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Off not found" });

    res.status(200).json({ message: "Off deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete off", details: err.message });
  }
});

// فعال/غیرفعال کردن تخفیف
offsRouter.put("/active-off/:offID/:isActive", async (req, res) => {
  try {
    const offID = parseInt(req.params.offID);
    const isActive = req.params.isActive === "1" ? 1 : 0;

    if (isNaN(offID)) return res.status(400).json({ message: "Invalid offID" });

    const [result] = await pool.query("UPDATE Offs SET isActive = ? WHERE id = ?", [isActive, offID]);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Off not found" });

    res.status(200).json({ message: "Off status updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to update off", details: err.message });
  }
});

module.exports = offsRouter;
