const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const RecipeModel = require('../models/Recipes'); // تأكد من مسار المودل
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken');
const UserModel = require('../models/Users');

// 1. إعداد Multer لتخزين الصور
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // تأكد إنك عملت مجلد اسمه uploads في مشروعك
    cb(null, 'uploads/'); 
  },
  filename: (req, file, cb) => {
    // تسمية الملف باسم فريد (التاريخ + الاسم الأصلي)
    cb(null, Date.now() + path.extname(file.originalname)); 
  }
});

const upload = multer({ storage: storage });

// 2. ميدل وير للتحقق من التوكن (Middleware)
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ message: "No token provided" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.userId = decoded.id; // خزنا الـ ID عشان نستخدمه تحت
    next();
  });
};

// 3. راوت إنشاء الوصفة
// upload.array('images', 5) تعني نستقبل صور بحد أقصى 5
router.post('/create-recipe', verifyToken, upload.array('images', 5), async (req, res) => {
  try {
    const { name, instructions, cookingTime, category, difficulty } = req.body;
    
    // معالجة المكونات (لأنها قد تصل كنص أو مصفوفة حسب الفورم داتا)
    let ingredients = req.body['ingredients[]'] || req.body.ingredients;
    if (typeof ingredients === 'string') {
        ingredients = [ingredients]; // تحويل النص لمصفوفة لو كان عنصر واحد
    }

    // إنشاء روابط الصور (عشان نخزنها في الداتا بيز)
    // ملاحظة: غير عنوان السيرفر حسب IP جهازك أو استخدم process.env.BASE_URL
    // مثال للرابط: http://192.168.1.5:3000/uploads/filename.jpg
 // ✅ كود جديد: بخزن اسم الملف فقط (مثل: image-12345.jpg)
const imageUrls = req.files.map(file => file.filename);

    const newRecipe = new RecipeModel({
      name,
      ingredients, // تأكدنا إنها مصفوفة
      instructions,
      imageUrls, // مصفوفة روابط الصور
      cookingTime: Number(cookingTime),
      category,
      difficulty,
      userOwner: req.userId, // جبناه من التوكن
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
    // بحث عن الوصفات التي يملكها هذا المستخدم (req.userId جاي من التوكن)
    const recipes = await RecipeModel.find({ userOwner: req.userId });
    res.json(recipes);
  } catch (err) {
    res.status(500).json({ message: "Error fetching user recipes", error: err.message });
  }
});


router.delete('/delete-recipe/:id', verifyToken, async (req, res) => {
  try {
    const recipe = await RecipeModel.findOneAndDelete({
      _id: req.params.id,
      userOwner: req.userId
    });

    if (!recipe) {
      return res.status(404).json({ message: "Recipe not found or unauthorized" });
    }

    // 🟢 حذف الوصفة من كل savedRecipes عند كل المستخدمين
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
// ملاحظة: هذا الراوت لتعديل النصوص حالياً لتبسيط الأمور
router.put('/update-recipe/:id', verifyToken, async (req, res) => {
  try {
    const { name, instructions, cookingTime, category, difficulty, ingredients } = req.body;

    // معالجة المكونات اذا وصلت كنص
    let ingredientsArray = ingredients;
    if (typeof ingredients === 'string') {
        ingredientsArray = ingredients.split('\n'); // نفترض ان كل سطر مكون
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
      { new: true } // عشان يرجع النسخة الجديدة بعد التعديل
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


// 4. Toggle Favorite Recipe (Add/Remove)
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
            // الوصفة ليست موجودة، نقوم بإضافتها
            user.savedRecipes.push(recipeId);
            message = "Recipe added to favorites ❤️";
            isFavorite = true;
        } else {
            // الوصفة موجودة، نقوم بإزالتها
            user.savedRecipes.splice(recipeIndex, 1);
            message = "Recipe removed from favorites 💔";
            isFavorite = false;
        }

        await user.save();
        
        // نرسل الرد مع حالة المفضلة الجديدة
        res.status(200).json({ 
            message: message, 
            isFavorite: isFavorite 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error" });
    }
});


// 9. جلب الوصفات المفضلة للمستخدم الحالي (Populate)
router.get('/my-favorites', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        
        // جلب بيانات المستخدم مع تعبئة (Populate) حقل savedRecipes بالوصفات الكاملة
        const user = await UserModel.findById(userId)
            .populate({
                path: 'savedRecipes',
                select: 'name imageUrls instructions ingredients cookingTime category difficulty userOwner' // اختر الحقول التي تحتاجها
            })
            .select('savedRecipes'); // نختار فقط مصفوفة المفضلة

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // إرجاع مصفوفة الوصفات المفضلة
        res.json(user.savedRecipes);

    } catch (error) {
        console.error("Error fetching favorites:", error);
        res.status(500).json({ message: "Server Error" });
    }
}); 

module.exports = router;