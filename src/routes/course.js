const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const CourseSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    category: String,
    duration: String,
    price: Number,
    offerPrice: Number,
    imageUrl: String,
    level: { type: String, default: "Beginner" },
    language: { type: String, default: "English" },
    learningPoints: [String],
    includedItems: [String],
    curriculum: [
        {
            title: String,
            type: String, // Video, Assessment, etc.
            duration: String,
            videoUrl: String, // YouTube or other link
        },
    ],
    status: { type: String, default: "Draft" },
    createdAt: { type: Date, default: Date.now },
});

const Course = mongoose.models.Course || mongoose.model("Course", CourseSchema);

// GET ALL COURSES
router.get("/", async (req, res) => {
    try {
        const courses = await Course.find().sort({ createdAt: -1 });
        res.json(courses);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch courses" });
    }
});

// CREATE COURSE
router.post("/", async (req, res) => {
    try {
        const course = new Course(req.body);
        await course.save();
        res.status(201).json(course);
    } catch (err) {
        res.status(400).json({ error: "Failed to create course", details: err.message });
    }
});

// UPDATE COURSE
router.put("/:id", async (req, res) => {
    try {
        const course = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!course) return res.status(404).json({ error: "Course not found" });
        res.json(course);
    } catch (err) {
        res.status(400).json({ error: "Failed to update course", details: err.message });
    }
});

// DELETE COURSE
router.delete("/:id", async (req, res) => {
    try {
        await Course.findByIdAndDelete(req.params.id);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: "Failed to delete course" });
    }
});

module.exports = router;
