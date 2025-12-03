const express = require("express");
const pool = require("./../db/DidikalaDB");

const bankCardsRouter = express.Router();

bankCardsRouter.get("/", async (req, res) => {
  try {
    const sql = `
      SELECT 
        c.id,
        c.card_number,
        c.bank_name,
        c.bank_logo,
        c.status,
        c.created_at,
        u.id AS user_id,
        u.username
      FROM card_details c
      INNER JOIN users u ON u.id = c.user_id
    `;
    const [result] = await pool.query(sql);
    res.status(200).json(result);
  } catch (err) {
    console.error("Error fetching bank cards:", err);
    res.status(500).json({ message: "Failed to fetch bank cards", details: err.message });
  }
});

bankCardsRouter.get("/user/:userID", async (req, res) => {
  try {
    const userID = parseInt(req.params.userID);
    if (isNaN(userID)) return res.status(400).json({ message: "Invalid userID" });

    const sql = `
      SELECT 
        id,
        card_number,
        bank_name,
        bank_logo,
        status,
        created_at
      FROM card_details 
      WHERE user_id = ?
    `;
    const [result] = await pool.query(sql, [userID]);

    res.status(200).json(result);
  } catch (err) {
    console.error("Error fetching user's bank cards:", err);
    res.status(500).json({ message: "Failed to fetch user's bank cards", details: err.message });
  }
});

bankCardsRouter.post("/", async (req, res) => {
  try {
    const { user_id, card_number } = req.body;

    if (!user_id || !card_number) {
      return res.status(400).json({ message: "user_id و card_number الزامی هستند" });
    }

    const cardRegex = /^[0-9]{16}$/;
    if (!cardRegex.test(card_number)) {
      return res.status(400).json({ message: "شماره کارت باید 16 رقم عددی باشد" });
    }

    const bankBins = {
      "6037": { name: "بانک ملی ایران", logo: "melli-bank-logo" },
      "5859": { name: "بانک تجارت", logo: "tejarat-bank-logo" },
      "5892": { name: "بانک سپه", logo: "sepah-bank-logo" },
      "6037": { name: "بانک کشاورزی", logo: "keshavarzi-bank-logo" },
      "6276": { name: "بانک صادرات ایران", logo: "saderat-bank-logo" },
      "6280": { name: "بانک مسکن", logo: "maskan-bank-logo" },
      "6274": { name: "بانک اقتصاد نوین", logo: "eghtesad-novin-bank-logo" },
      "6221": { name: "بانک پارسیان", logo: "parsian-bank-logo" },
      "6219": { name: "بانک سامان", logo: "saman-bank-logo" },
      "5022": { name: "بانک پاسارگاد", logo: "pasargad-bank-logo" },
      "6104": { name: "بانک ملت", logo: "mellat-bank-logo" },
      "6396": { name: "بانک سرمایه", logo: "sarmayeh-bank-logo" },
      "5029": { name: "بانک دی / توسعه تعاون", logo: "day-bank-logo" },
      "5054": { name: "بانک ایران زمین", logo: "iranzamin-bank-logo" },
      "5057": { name: "بانک خاورمیانه", logo: "khavarmiyaneh-bank-logo" },
      "6369": { name: "بانک مهر اقتصاد", logo: "mehr-bank-logo" },
      "6063": { name: "بانک قرض‌الحسنه رسالت", logo: "resalat-bank-logo" },
      "6393": { name: "بانک قوامین", logo: "ghavamin-bank-logo" },
      "6277": { name: "پست بانک ایران", logo: "postbank-bank-logo" },
      "6362": { name: "بانک آینده", logo: "ayandeh-bank-logo" },
      "5058": { name: "بانک گردشگری", logo: "gardeshgari-bank-logo" },
      "6279": { name: "بانک صنعت و معدن", logo: "sanat-madan-bank-logo" },
      "6276": { name: "بانک توسعه صادرات", logo: "edbi-bank-logo" },
      "6392": { name: "بانک توسعه تعاون", logo: "taavon-bank-logo" },
      "6273": { name: "بانک انصار", logo: "ansar-bank-logo" },
      "5029": { name: "بانک دی", logo: "day-bank-logo" },
      "5894": { name: "بانک رفاه کارگران", logo: "refah-bank-logo" }
    };

    const bin = card_number.substring(0, 4);
    const bankInfo = bankBins[bin] || { name: "بانک نامشخص", logo: "default" };

    const sql = `
      INSERT INTO card_details (user_id, card_number, bank_name, bank_logo, status)
      VALUES (?, ?, ?, ?, ?)
    `;
    const [result] = await pool.query(sql, [
      user_id,
      card_number,
      bankInfo.name,
      bankInfo.logo,
      "active"
    ]);

    res.status(201).json({
      message: "Bank card added successfully",
      cardID: result.insertId,
      bank: bankInfo
    });
  } catch (err) {
    console.error("Error adding bank card:", err);
    res.status(500).json({ message: "Failed to add bank card", details: err.message });
  }
});

bankCardsRouter.delete("/:cardID", async (req, res) => {
  try {
    const cardID = parseInt(req.params.cardID);
    if (isNaN(cardID)) return res.status(400).json({ message: "Invalid cardID" });

    const sql = "DELETE FROM card_details WHERE id = ?";
    const [result] = await pool.query(sql, [cardID]);

    if (result.affectedRows === 0) return res.status(404).json({ message: "Bank card not found" });

    res.status(200).json({ message: "Bank card deleted successfully" });
  } catch (err) {
    console.error("Error deleting bank card:", err);
    res.status(500).json({ message: "Failed to delete bank card", details: err.message });
  }
});

bankCardsRouter.put("/status/:cardID/:status", async (req, res) => {
  try {
    const cardID = parseInt(req.params.cardID);
    const status = req.params.status === "active" ? "active" : "inactive";

    if (isNaN(cardID)) return res.status(400).json({ message: "Invalid cardID" });

    const sql = "UPDATE card_details SET status = ? WHERE id = ?";
    const [result] = await pool.query(sql, [status, cardID]);

    if (result.affectedRows === 0) return res.status(404).json({ message: "Bank card not found" });

    res.status(200).json({ message: "Bank card status updated successfully" });
  } catch (err) {
    console.error("Error updating bank card status:", err);
    res.status(500).json({ message: "Failed to update bank card status", details: err.message });
  }
});

module.exports = bankCardsRouter;
