const express = require("express");
const pool = require("../db/DidikalaDB"); 

const productsRouter = express.Router();

// GET all Products
productsRouter.get("/", async (req, res) => {
  try {
    const [products] = await pool.query("SELECT * FROM Products");
    res.status(200).json(products);
  } catch (err) {
    console.error("Error fetching Products:", err);
    res.status(500).json({ error: "خطا در دریافت محصولات" });
  }
});

// POST add new product
productsRouter.post("/", async (req, res) => {
  const {
    title,
    price,
    count,
    img,
    popularity,
    sale,
    hasDiscount,
    discountEndDate,
    discountPercent,
    colors,
    productDesc,
    url,
    categoryID,
  } = req.body;

  if (!title || price === undefined || count === undefined || !categoryID) {
    return res
      .status(400)
      .json({ error: "title، price، count و categoryID الزامی هستند" });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO Products
       (title, price, count, img, popularity, sale, hasDiscount,
        discountEndDate, discountPercent, colors, productDesc, url, categoryID)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        price,
        count,
        img || null,
        popularity || 0,
        sale || 0,
        hasDiscount ? 1 : 0,
        discountEndDate || null,
        discountPercent || null,
        colors || null,
        productDesc || "",
        url || "",
        categoryID,
      ]
    );

    res
      .status(201)
      .json({ message: "Product added successfully", productID: result.insertId });
  } catch (err) {
    console.error("Error adding product:", err);
    res.status(500).json({ error: "خطا در افزودن محصول" });
  }
});

// PUT update product
productsRouter.put("/:productID", async (req, res) => {
  const productID = req.params.productID;
  const {
    title,
    price,
    count,
    img,
    popularity,
    sale,
    hasDiscount,
    discountEndDate,
    discountPercent,
    colors,
    productDesc,
    url,
    categoryID,
  } = req.body;

  if (!/^\d+$/.test(productID)) {
    return res.status(400).json({ error: "productID نامعتبر است" });
  }

  try {
    const [result] = await pool.query(
      `UPDATE Products
       SET title = ?, price = ?, count = ?, img = ?, popularity = ?, sale = ?,
           hasDiscount = ?, discountEndDate = ?, discountPercent = ?,
           colors = ?, productDesc = ?, url = ?, categoryID = ?
       WHERE id = ?`,
      [
        title,
        price,
        count,
        img || null,
        popularity || 0,
        sale || 0,
        hasDiscount ? 1 : 0,
        discountEndDate || null,
        discountPercent || null,
        colors || null,
        productDesc || "",
        url || "",
        categoryID,
        productID,
      ]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ error: "محصول یافت نشد" });

    res.status(200).json({ message: "Product updated successfully" });
  } catch (err) {
    console.error("Error updating product:", err);
    res.status(500).json({ error: "خطا در ویرایش محصول" });
  }
});

// DELETE product
productsRouter.delete("/:productID", async (req, res) => {
  const productID = req.params.productID;
  if (!/^\d+$/.test(productID))
    return res.status(400).json({ error: "productID نامعتبر است" });

  try {
    const [result] = await pool.query("DELETE FROM Products WHERE id = ?", [productID]);
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "محصول یافت نشد" });

    res.status(200).json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error("Error deleting product:", err);
    res.status(500).json({ error: "خطا در حذف محصول" });
  }
});

module.exports = productsRouter;
