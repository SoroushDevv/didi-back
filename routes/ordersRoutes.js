const express = require("express");
// فرض بر این است که فایل pool.js یک اتصال معتبر به دیتابیس MySQL فراهم می‌کند
const pool = require("./../db/DidikalaDB");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const ordersRouter = express.Router();

/**
 * Middleware for authentication: Verifies JWT token
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ message: "Authentication token required" });

  try {
    // Use the secret key from environment variables or a default
    const user = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
    req.user = user;
    next();
  } catch {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

// ==================================================
// POST Create Order (خطای ReferenceError اصلاح شد)
// ==================================================
ordersRouter.post("/", authenticateToken, async (req, res) => {
  try {
    const { userID, date, hour, items } = req.body;

    // --- لاگ‌های دیباگ برای تأیید داده‌های ورودی ---
    console.log("--- INCOMING ORDER DATA ---");
    console.log("Request Body:", req.body);
    console.log("Items Array:", items);

    // --- Input Validation ---
    if (!userID || isNaN(userID)) return res.status(400).json({ message: "UserID required" });
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ message: "Invalid date format (YYYY-MM-DD)" });
    if (!hour || !/^\d{2}:\d{2}:\d{2}$/.test(hour)) return res.status(400).json({ message: "Invalid hour format (HH:MM:SS)" });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: "Order must contain at least one product" });

    // Check if User exists (Assuming a Users table exists)
    const [userResult] = await pool.query("SELECT id FROM Users WHERE id = ?", [userID]);
    if (userResult.length === 0) return res.status(404).json({ message: "User not found" });

    // Generate and store UUID in orderCode
    const orderCode = crypto.randomUUID();

    // 1. Insert into Orders table
    const [orderInsert] = await pool.query(
      "INSERT INTO Orders (orderCode, userID, date, hour, isActive) VALUES (?, ?, ?, ?, ?)",
      [orderCode, userID, date, hour, 1] // isActive is set to 1 (active) by default
    );

    const orderID = orderInsert.insertId;
    const orderItems = [];
    const itemInserts = [];

    // 2. Process items and prepare data for Order_items batch insert
    for (const item of items) {
        console.log("Processing item:", item);
        
      const { productID, quantity = 1, color } = item; 

      // Basic item validation
      if (!productID || isNaN(productID)) {
        console.warn(`Skipping item due to invalid productID: ${productID}`);
        continue;
      }
      // Assuming color is mandatory based on original logic
      if (!color || color.trim() === "") {
        console.warn(`Skipping item for productID ${productID} due to missing color.`);
        continue;
      }

      // Fetch current price from Products table 
      const [productResult] = await pool.query(
        "SELECT id, price FROM Products WHERE id = ?",
        [productID]
      );
      if (productResult.length === 0) {
        console.warn(`Product ID ${productID} not found. Skipping.`);
        continue;
      }

      const price = productResult[0].price;

      // Prepare batch insert for Order_items (orderID, productID, quantity, color, price)
      itemInserts.push([orderID, productID, quantity, color, price]);

      // Prepare response data
      orderItems.push({ productID, quantity, color, price });
    }

    if (itemInserts.length === 0) {
      // If no valid items were processed, clean up the order and return an error
      await pool.query("DELETE FROM Orders WHERE id = ?", [orderID]);
      return res.status(400).json({ message: "Order contained no valid products or product details." });
    }

    // 3. Execute batch insert for Order_items
    // خطای قبلی که به دلیل استفاده از productID در خارج از محدوده (Scope) رخ می‌داد، در این نسخه حذف شده است.
    const orderItemQuery = "INSERT INTO Order_items (orderID, productID, quantity, color, price) VALUES ?";
    
    // اجرای کوئری درج دسته‌ای با آرایه itemInserts
    await pool.query(orderItemQuery, [itemInserts]);


    const newOrder = {
      orderID,
      orderCode,
      userID,
      date,
      hour,
      isActive: 1,
      items: orderItems
    };

    // Emit socket event (assuming socket.io is configured on app)
    const io = req.app.get("io");
    if (io) io.emit("order_created", newOrder);

    res.status(201).json({ message: "Order created successfully", order: newOrder });
  } catch (err) {
    console.error("❌ Error creating order:", err);
    res.status(500).json({ message: "Database error", details: err.message });
  }
});

// ==================================================
// GET All Orders
// ==================================================
ordersRouter.get("/", async (req, res) => {
  try {
    const [orders] = await pool.query(`
            SELECT 
                o.id AS orderID,
      o.orderCode,
      o.userID,
      o.date,
      o.hour,
      o.isActive,
      oi.id AS orderItemID,
        oi.productID,
        oi.quantity,
        oi.color,
        oi.price
            FROM Orders o
            LEFT JOIN Order_items oi ON o.id = oi.orderID
            ORDER BY o.date DESC, o.hour DESC
      `);

    // Group order items under their respective orders
    const ordersMap = {};
    orders.forEach(row => {
      if (!ordersMap[row.orderID]) {
        ordersMap[row.orderID] = {
          orderID: row.orderID,
          orderCode: row.orderCode,
          userID: row.userID,
          date: row.date,
          hour: row.hour,
          isActive: row.isActive,
          items: []
        };
      }
      // Ensure order item data is present (LEFT JOIN returns nulls if no items exist)
      if (row.orderItemID) {
        ordersMap[row.orderID].items.push({
          orderItemID: row.orderItemID,
          productID: row.productID,
          quantity: row.quantity,
          color: row.color,
          // Price is stored as DECIMAL in DB, converting to string/number is fine here
          price: row.price
        });
      }
    });

    res.status(200).json(Object.values(ordersMap));
  } catch (err) {
    console.error("❌ Error fetching orders:", err);
    res.status(500).json({ message: "Database error", details: err.message });
  }
});

// ==================================================
// GET Orders By User
// ==================================================
ordersRouter.get("/user/:userID", authenticateToken, async (req, res) => {
  try {
    const userID = parseInt(req.params.userID);
    if (isNaN(userID)) return res.status(400).json({ message: "Invalid userID" });

    // Optional: Authorization check (ensure requesting user is the same as userID or is an admin)
    // if (req.user.id !== userID && req.user.role !== 'admin') {
    //     return res.status(403).json({ message: "Access denied" });
    // }

    const [orders] = await pool.query(`
    SELECT
    o.id AS orderID,
      o.orderCode,
      o.userID,
      o.date,
      o.hour,
      o.isActive,
      oi.id AS orderItemID,
        oi.productID,
        oi.quantity,
        oi.color,
        oi.price
            FROM Orders o
            LEFT JOIN Order_items oi ON o.id = oi.orderID
            WHERE o.userID = ?
      ORDER BY o.date DESC, o.hour DESC
        `, [userID]);

    // Group order items under their respective orders
    const ordersMap = {};
    orders.forEach(row => {
      if (!ordersMap[row.orderID]) {
        ordersMap[row.orderID] = {
          orderID: row.orderID,
          orderCode: row.orderCode,
          userID: row.userID,
          date: row.date,
          hour: row.hour,
          isActive: row.isActive,
          items: []
        };
      }
      if (row.orderItemID) {
        ordersMap[row.orderID].items.push({
          orderItemID: row.orderItemID,
          productID: row.productID,
          quantity: row.quantity,
          color: row.color,
          price: row.price
        });
      }
    });

    res.status(200).json(Object.values(ordersMap));
  } catch (err) {
    console.error("❌ Error fetching user orders:", err);
    res.status(500).json({ message: "Database error", details: err.message });
  }
});

// ==================================================
// DELETE Order
// ==================================================
ordersRouter.delete("/:orderID", authenticateToken, async (req, res) => {
  try {
    const orderID = parseInt(req.params.orderID);
    if (isNaN(orderID)) return res.status(400).json({ message: "Invalid orderID" });

    // Deleting items first is necessary if Foreign Key constraints are set
    await pool.query("DELETE FROM Order_items WHERE orderID = ?", [orderID]);
    const [result] = await pool.query("DELETE FROM Orders WHERE id = ?", [orderID]);

    if (result.affectedRows === 0) return res.status(404).json({ message: "Order not found" });

    // Emit socket event
    const io = req.app.get("io");
    if (io) io.emit("order_deleted", { orderID });

    res.status(200).json({ message: "Order deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting order:", err);
    res.status(500).json({ message: "Database error", details: err.message });
  }
});

// ==================================================
// PUT Update Active Status and Order Items
// ==================================================
ordersRouter.put("/active-order/:orderID", authenticateToken, async (req, res) => {
  try {
    const orderID = parseInt(req.params.orderID);
    const { isActive, items } = req.body;

    if (isNaN(orderID) || orderID <= 0) return res.status(400).json({ message: "Invalid orderID" });

    // 1. Update isActive status of the Order
    if (isActive !== undefined) {
      const [updateOrderResult] = await pool.query("UPDATE Orders SET isActive = ? WHERE id = ?", [isActive ? 1 : 0, orderID]);
      if (updateOrderResult.affectedRows === 0) return res.status(404).json({ message: "Order not found" });
    }

    // 2. Update specific Order_items
    if (Array.isArray(items)) {
      for (const item of items) {
        const { orderItemID, quantity, color } = item;
        const updates = [];
        const values = [];

        if (quantity !== undefined) { updates.push("quantity = ?"); values.push(quantity); }
        if (color !== undefined) { updates.push("color = ?"); values.push(color); }

        if (updates.length > 0 && orderItemID) {
          values.push(orderItemID);
          await pool.query(`UPDATE Order_items SET ${updates.join(", ")} WHERE id = ? `, values);
        }
      }
    }

    // Emit socket event
    const io = req.app.get("io");
    if (io) io.emit("order_updated", { orderID, isActive, items });

    res.status(200).json({ message: "Order updated successfully" });
  } catch (err) {
    console.error("❌ Error updating order:", err);
    res.status(500).json({ message: "Database error", details: err.message });
  }
});

module.exports = ordersRouter;