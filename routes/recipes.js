const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const RecipeModel = require('../models/Recipes');
const UserModel = require('../models/Users');
const jwt = require('jsonwebtoken');

// --- ☁️ إعدادات Cloudinary ---
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// تهيئة Cloudinary بالمفاتيح الموجودة في Environment Variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// إعداد التخزين (Storage) ليرفع الصور على Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'tastella_recipes', // اسم المجلد في Cloudinary
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'], // الصيغ المسموحة
  },
});

const upload = multer({ storage: storage });
// ------------------------------

// 2. ميدل وير للتحقق من التوكن (Middleware)
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ message: "No token provided" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.userId = decoded.id; 
    next();
  });
};

// 3. راوت إنشاء الوصفة
router.post('/create-recipe', verifyToken, upload.array('images', 5), async (req, res) => {
  try {
    const { name, instructions, cookingTime, category, difficulty } = req.body;
    
    // معالجة المكونات
    let ingredients = req.body['ingredients[]'] || req.body.ingredients;
    if (typeof ingredients === 'string') {
        ingredients = [ingredients]; 
    }

    // ✅ التعديل الجديد: Cloudinary بيعطينا الرابط جاهز في `path`
    // إذا لم ترفع صور، نجعل المصفوفة فارغة لتجنب الأخطاء
    const imageUrls = req.files ? req.files.map(file => file.path) : [];

    const newRecipe = new RecipeModel({
      name,
      ingredients, 
      instructions,
      imageUrls, // الآن تحتوي على روابط Cloudinary الكاملة (https://...)
      cookingTime: Number(cookingTime),
      category,
      difficulty,
      userOwner: req.userId,
    });

    await newRecipe.save();
    res.json({ message: "Recipe Created Successfully! 🎉", recipe: newRecipe });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creating recipe", error: err.message });
  }
});

// 4. راوت لجلب وصفات المستخدم المسجل فقط
router.get('/my-recipes', verifyToken, async (req, res) => {
  try {
    const recipes = await RecipeModel.find({ userOwner: req.userId });
    res.json(recipes);
  } catch (err) {
    res.status(500).json({ message: "Error fetching user recipes", error: err.message });
  }
});

// 5. حذف وصفة
router.delete('/delete-recipe/:id', verifyToken, async (req, res) => {
  try {
    const recipe = await RecipeModel.findOneAndDelete({
      _id: req.params.id,
      userOwner: req.userId
    });

    if (!recipe) {
      return res.status(404).json({ message: "Recipe not found or unauthorized" });
    }

    // حذف الوصفة من مفضلة الجميع
    await UserModel.updateMany(
      {},
      { $pull: { savedRecipes: recipe._id } }
    );

    res.json({ message: "Recipe Deleted Successfully 🗑️ (and removed from all favorites)" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. تعديل وصفة (Update Recipe)
router.put('/update-recipe/:id', verifyToken, async (req, res) => {
  try {
    const { name, instructions, cookingTime, category, difficulty, ingredients } = req.body;

    let ingredientsArray = ingredients;
    if (typeof ingredients === 'string') {
        ingredientsArray = ingredients.split('\n');
    }

    const updatedRecipe = await RecipeModel.findOneAndUpdate(
      { _id: req.params.id, userOwner: req.userId },
      { 
        name, 
        instructions, 
        cookingTime, 
        category, 
        difficulty,
        ingredients: ingredientsArray 
      },
      { new: true } 
    );

    if (!updatedRecipe) {
      return res.status(404).json({ message: "Recipe not found or unauthorized" });
    }

    res.json({ message: "Recipe Updated! ✨", recipe: updatedRecipe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. جلب وصفات مستخدم معين (بواسطة الـ ID)
router.get('/user-recipes/:userId', async (req, res) => {
  try {
    const recipes = await RecipeModel.find({ userOwner: req.params.userId });
    res.json(recipes);
  } catch (err) {
    res.status(500).json({ message: "Error fetching recipes" });
  }
});

// 4. Toggle Favorite Recipe
router.post('/favorite-toggle', verifyToken, async (req, res) => {
    try {
        const { recipeId } = req.body;
        const userId = req.userId;

        const user = await UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const recipeIndex = user.savedRecipes.indexOf(recipeId);
        let message;
        let isFavorite;

        if (recipeIndex === -1) {
            user.savedRecipes.push(recipeId);
            message = "Recipe added to favorites ❤️";
            isFavorite = true;
        } else {
            user.savedRecipes.splice(recipeIndex, 1);
            message = "Recipe removed from favorites 💔";
            isFavorite = false;
        }

        await user.save();
        
        res.status(200).json({ 
            message: message, 
            isFavorite: isFavorite 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error" });
    }
});

// 9. جلب الوصفات المفضلة
router.get('/my-favorites', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        
        const user = await UserModel.findById(userId)
            .populate({
                path: 'savedRecipes',
                select: 'name imageUrls instructions ingredients cookingTime category difficulty userOwner'
            })
            .select('savedRecipes');

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json(user.savedRecipes);

    } catch (error) {
        console.error("Error fetching favorites:", error);
        res.status(500).json({ message: "Server Error" });
    }
}); 

module.exports = router;