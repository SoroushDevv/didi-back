const express = require("express");
const pool = require("./../db/DidikalaDB");

const blogsRouter = express.Router();

// GET: دریافت تمام بلاگ‌ها
blogsRouter.get("/", async (req, res) => {
  try {
    const selectAllBlogsQuery = `
      SELECT 
        id, title, slug, category, excerpt, content, cover_image, authorID, related_productID, status, views_count, likes_count, seo_title, seo_description, created_at, published_at
      FROM blogs
      ORDER BY created_at DESC
    `;
    const [result] = await pool.query(selectAllBlogsQuery);

    res.status(200).json(result);
  } catch (err) {
    console.error("Error fetching blogs:", err);
    res.status(500).json({ message: "Failed to fetch blogs", details: err.message });
  }
});

// GET: دریافت یک بلاگ خاص
blogsRouter.get("/:blogID", async (req, res) => {
  try {
    const blogID = parseInt(req.params.blogID);
    if (isNaN(blogID)) return res.status(400).json({ message: "Invalid blogID" });

    const [result] = await pool.query("SELECT * FROM blogs WHERE id = ?", [blogID]);
    if (result.length === 0) return res.status(404).json({ message: "Blog not found" });

    res.status(200).json(result[0]);
  } catch (err) {
    console.error("Error fetching blog:", err);
    res.status(500).json({ message: "Failed to fetch blog", details: err.message });
  }
});

// POST: ایجاد بلاگ جدید
blogsRouter.post("/", async (req, res) => {
  try {
    const { title, slug, category, excerpt, content, cover_image, authorID, related_productID, status, seo_title, seo_description, published_at } = req.body;

    if (!title || !slug || !content || !authorID) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const insertQuery = `
      INSERT INTO blogs 
      (title, slug, category, excerpt, content, cover_image, authorID, related_productID, status, seo_title, seo_description, published_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await pool.query(insertQuery, [
      title, slug, category, excerpt, content, cover_image, authorID, related_productID || null, status || "draft", seo_title, seo_description, published_at || null
    ]);

    res.status(201).json({ message: "Blog created successfully", blogID: result.insertId });
  } catch (err) {
    console.error("Error creating blog:", err);
    res.status(500).json({ message: "Failed to create blog", details: err.message });
  }
});

// PUT: ویرایش بلاگ
blogsRouter.put("/:blogID", async (req, res) => {
  try {
    const blogID = parseInt(req.params.blogID);
    if (isNaN(blogID)) return res.status(400).json({ message: "Invalid blogID" });

    const { title, slug, category, excerpt, content, cover_image, authorID, related_productID, status, seo_title, seo_description, published_at } = req.body;

    const updateQuery = `
      UPDATE blogs SET 
        title=?, slug=?, category=?, excerpt=?, content=?, cover_image=?, authorID=?, related_productID=?, status=?, seo_title=?, seo_description=?, published_at=?
      WHERE id=?
    `;
    const [result] = await pool.query(updateQuery, [
      title, slug, category, excerpt, content, cover_image, authorID, related_productID || null, status || "draft", seo_title, seo_description, published_at || null, blogID
    ]);

    if (result.affectedRows === 0) return res.status(404).json({ message: "Blog not found" });

    res.status(200).json({ message: "Blog updated successfully" });
  } catch (err) {
    console.error("Error updating blog:", err);
    res.status(500).json({ message: "Failed to update blog", details: err.message });
  }
});

// DELETE: حذف بلاگ
blogsRouter.delete("/:blogID", async (req, res) => {
  try {
    const blogID = parseInt(req.params.blogID);
    if (isNaN(blogID)) return res.status(400).json({ message: "Invalid blogID" });

    const [result] = await pool.query("DELETE FROM blogs WHERE id = ?", [blogID]);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Blog not found" });

    res.status(200).json({ message: "Blog deleted successfully" });
  } catch (err) {
    console.error("Error deleting blog:", err);
    res.status(500).json({ message: "Failed to delete blog", details: err.message });
  }
});

module.exports = blogsRouter;
