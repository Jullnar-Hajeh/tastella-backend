const express = require('express');
const router = express.Router();
const NoteModel = require('../models/Notes');
const jwt = require('jsonwebtoken');
const multer = require('multer'); 
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); 
  },
  filename: (req, file, cb) => {
    cb(null, 'note-' + Date.now() + path.extname(file.originalname)); 
  }
});

const upload = multer({ storage: storage });

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ message: "No token provided" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.userId = decoded.id;
    next();
  });
};

router.post('/add', verifyToken, upload.single('image'), async (req, res) => {
  try {
    const { title, content, color } = req.body;
    
    const newNote = new NoteModel({
      title,
      content,
      color,
      userOwner: req.userId,
      image: req.file ? req.file.filename : null 
    });

    await newNote.save();
    res.json({ message: "Note Added! 📝", note: newNote });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/my-notes', verifyToken, async (req, res) => {
  try {
    const notes = await NoteModel.find({ userOwner: req.userId }).sort({ createdAt: -1 });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/update/:id', verifyToken, upload.single('image'), async (req, res) => {
  try {
    const { title, content, color } = req.body;
    
    let updateData = { title, content, color };
    
    if (req.file) {
        updateData.image = req.file.filename;
    }

    const updatedNote = await NoteModel.findOneAndUpdate(
      { _id: req.params.id, userOwner: req.userId },
      updateData,
      { new: true }
    );
    res.json(updatedNote);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/delete/:id', verifyToken, async (req, res) => {
  try {
    await NoteModel.findOneAndDelete({ _id: req.params.id, userOwner: req.userId });
    res.json({ message: "Note Deleted 🗑️" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;