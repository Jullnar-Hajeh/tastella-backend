const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },
  
  userImage: { 
    type: String, 
    default: "https://cdn-icons-png.flaticon.com/512/149/149071.png" 
  }, 

  bio: { 
    type: String, 
    default: "",       
    maxLength: 200    
  },

  followers: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "users" 
  }],

  // 3. المُتابَعون (الناس اللي اليوزر عامل لهم فولو)
  following: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "users" 
  }],

  // -----------------------

savedRecipes: [{ type: mongoose.Schema.Types.ObjectId, ref: "recipes" }]

}, 
{ timestamps: true }
);

module.exports = mongoose.model("users", UserSchema);