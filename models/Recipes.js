const mongoose = require("mongoose");

const RecipeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  // لاحظي هنا: Ingredients هي مصفوفة (Array)
  ingredients: [{ type: String, required: true }], 
  instructions: { type: String, required: true },
  imageUrls: [{ type: String, required: true }], // مصفوفة صور
  cookingTime: { type: Number, required: true },
  
  // ضفنا الكاتيجوري هنا عشان نختاره من الواجهة
  category: { 
    type: String, 
    required: true,
    enum: ['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack'] 
  },

  difficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard'],
    default: 'Medium'
  },
  userOwner: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "users", 
    required: true 
  },
}, { timestamps: true });

module.exports = mongoose.model("recipes", RecipeSchema);