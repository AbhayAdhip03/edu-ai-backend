const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const ProjectSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    difficulty: { type: String, default: "Beginner" },
    status: { type: String, default: "Draft" },
    tags: [String],
    imageUrl: String,
    githubUrl: String,
    liveUrl: String,
    customSections: [
        {
            title: String,
            items: [String],
        },
    ],
    scheduledPublishDate: Date,
    createdAt: { type: Date, default: Date.now },
});

const Project = mongoose.models.Project || mongoose.model("Project", ProjectSchema);

// GET ALL PROJECTS
router.get("/", async (req, res) => {
    try {
        const projects = await Project.find().sort({ createdAt: -1 });
        res.json(projects);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch projects" });
    }
});

// CREATE PROJECT
router.post("/", async (req, res) => {
    try {
        const project = new Project(req.body);
        await project.save();
        res.status(201).json(project);
    } catch (err) {
        res.status(400).json({ error: "Failed to create project", details: err.message });
    }
});

// UPDATE PROJECT
router.put("/:id", async (req, res) => {
    try {
        const project = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!project) return res.status(404).json({ error: "Project not found" });
        res.json(project);
    } catch (err) {
        res.status(400).json({ error: "Failed to update project", details: err.message });
    }
});

// DELETE PROJECT
router.delete("/:id", async (req, res) => {
    try {
        await Project.findByIdAndDelete(req.params.id);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: "Failed to delete project" });
    }
});

module.exports = router;
