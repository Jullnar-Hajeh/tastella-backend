const mongoose = require("mongoose");

const NoteSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  color: { type: String, default: '#FFF' },
  // 👇 الإضافة الجديدة: خانة لاسم الصورة
  image: { type: String }, 
  userOwner: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "users", 
    required: true 
  },
}, { timestamps: true });

module.exports = mongoose.model("notes", NoteSchema);