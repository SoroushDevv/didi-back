const express = require("express");
const pool = require("./../db/DidikalaDB");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const ordersRouter = express.Router();

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


ordersRouter.post("/", authenticateToken, async (req, res) => {
    try {
        const { userID, date, hour, items } = req.body;

        console.log("--- INCOMING ORDER DATA ---");
        console.log("Request Body:", req.body);
        console.log("Items Array:", items);

        if (!userID || isNaN(userID)) return res.status(400).json({ message: "UserID required" });
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ message: "Invalid date format (YYYY-MM-DD)" });
        if (!hour || !/^\d{2}:\d{2}:\d{2}$/.test(hour)) return res.status(400).json({ message: "Invalid hour format (HH:MM:SS)" });
        if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: "order must contain at least one product" });

        const [userResult] = await pool.query("SELECT id FROM users WHERE id = ?", [userID]);
        if (userResult.length === 0) return res.status(404).json({ message: "User not found" });

        const orderCode = crypto.randomUUID();

        const [orderInsert] = await pool.query(
            "INSERT INTO orders (orderCode, userID, date, hour, isActive) VALUES (?, ?, ?, ?, ?)",
            [orderCode, userID, date, hour, 1]
        );

        const orderID = orderInsert.insertId;
        const orderItems = [];
        const itemInserts = [];

        for (const item of items) {
            console.log("Processing item:", item);

            const { productID, quantity = 1, color } = item;

            if (!productID || isNaN(productID)) {
                console.warn(`Skipping item due to invalid productID: ${productID}`);
                continue;
            }
            if (!color || color.trim() === "") {
                console.warn(`Skipping item for productID ${productID} due to missing color.`);
                continue;
            }

            const [productResult] = await pool.query(
                "SELECT id, price FROM products WHERE id = ?",
                [productID]
            );
            if (productResult.length === 0) {
                console.warn(`product ID ${productID} not found. Skipping.`);
                continue;
            }

            const price = productResult[0].price;

            itemInserts.push([orderID, productID, quantity, color, price]);

            orderItems.push({ productID, quantity, color, price });
        }

        if (itemInserts.length === 0) {
            await pool.query("DELETE FROM orders WHERE id = ?", [orderID]);
            return res.status(400).json({ message: "Order contained no valid products or product details." });
        }

        const orderItemQuery = "INSERT INTO order_items (orderID, productID, quantity, color, price) VALUES ?";

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

        const io = req.app.get("io");
        if (io) io.emit("order_created", newOrder);

        res.status(201).json({ message: "order created successfully", order: newOrder });
    } catch (err) {
        console.error("❌ Error creating order:", err);
        res.status(500).json({ message: "Database error", details: err.message });
    }
});


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
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.orderID
            ORDER BY o.date DESC, o.hour DESC`);

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
        console.error("❌ Error fetching orders:", err);
        res.status(500).json({ message: "Database error", details: err.message });
    }
});


ordersRouter.get("/user/:userID", authenticateToken, async (req, res) => {
    try {
        const userID = parseInt(req.params.userID);
        if (isNaN(userID)) return res.status(400).json({ message: "Invalid userID" });



        const [orders] = await pool.query(
            "SELECT o.id AS orderID, o.orderCode, o.userID, o.date, o.hour, o.isActive, oi.id AS orderItemID, oi.productID, oi.quantity, oi.color, oi.price FROM orders o LEFT JOIN order_items oi ON o.id = oi.orderID WHERE o.userID = ? ORDER BY o.date DESC, o.hour DESC",
            [userID]
        );

        console.log("orders:",orders)

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


ordersRouter.delete("/:orderID", authenticateToken, async (req, res) => {
    try {
        const orderID = parseInt(req.params.orderID);
        if (isNaN(orderID)) return res.status(400).json({ message: "Invalid orderID" });

        await pool.query("DELETE FROM order_items WHERE orderID = ?", [orderID]);
        const [result] = await pool.query("DELETE FROM orders WHERE id = ?", [orderID]);

        if (result.affectedRows === 0) return res.status(404).json({ message: "order not found" });

        const io = req.app.get("io");
        if (io) io.emit("order_deleted", { orderID });

        res.status(200).json({ message: "order deleted successfully" });
    } catch (err) {
        console.error("❌ Error deleting order:", err);
        res.status(500).json({ message: "Database error", details: err.message });
    }
});


ordersRouter.put("/active-order/:orderID", authenticateToken, async (req, res) => {
    try {
        const orderID = parseInt(req.params.orderID);
        const { isActive, items } = req.body;

        if (isNaN(orderID) || orderID <= 0) return res.status(400).json({ message: "Invalid orderID" });

        if (isActive !== undefined) {
            const [updateOrderResult] = await pool.query("UPDATE orders SET isActive = ? WHERE id = ?", [isActive ? 1 : 0, orderID]);
            if (updateOrderResult.affectedRows === 0) return res.status(404).json({ message: "Order not found" });
        }

        if (Array.isArray(items)) {
            for (const item of items) {
                const { orderItemID, quantity, color } = item;
                const updates = [];
                const values = [];

                if (quantity !== undefined) { updates.push("quantity = ?"); values.push(quantity); }
                if (color !== undefined) { updates.push("color = ?"); values.push(color); }

                if (updates.length > 0 && orderItemID) {
                    values.push(orderItemID);
                    await pool.query(`UPDATE order_items SET ${updates.join(", ")} WHERE id = ? `, values);
                }
            }
        }

        const io = req.app.get("io");
        if (io) io.emit("order_updated", { orderID, isActive, items });

        res.status(200).json({ message: "Order updated successfully" });
    } catch (err) {
        console.error("❌ Error updating order:", err);
        res.status(500).json({ message: "Database error", details: err.message });
    }
});

module.exports = ordersRouter;