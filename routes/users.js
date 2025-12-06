const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const UserModel = require('../models/Users');
const multer = require('multer'); 
const path = require('path');

// إعداد Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); 
  },
  filename: (req, file, cb) => {
    cb(null, 'user-' + Date.now() + path.extname(file.originalname)); 
  }
});

const upload = multer({ storage: storage })

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

// --- Routes ---

// 1. Register
router.post('/register', async (req, res) => {
  const { username, password, email, userImage } = req.body;

  const user = await UserModel.findOne({ username });
  if (user) {
    return res.json({ message: "Username already exists!" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = new UserModel({ 
    username, 
    password: hashedPassword,
    email,
    userImage: userImage 
  });
  
  await newUser.save();

  res.json({ message: "User registered successfully! ✅" });
});

// 2. Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const user = await UserModel.findOne({ username });
  if (!user) {
    return res.json({ message: "User doesn't exist!" });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.json({ message: "Username or Password is incorrect!" });
  }

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

  res.json({ token, userID: user._id, userImage: user.userImage, message: "Login Successful! 🔓" });
});

// 3. Get Profile (جلب البيانات)
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await UserModel.findById(req.userId).select('-password');
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
});





router.put('/update-profile', verifyToken, upload.single('image'), async (req, res) => {
    try {
        const { username, email, bio } = req.body;
        
        let updateData = { username, email, bio };

        if (req.file) {
            // ✅ التعديل: حفظ اسم الملف فقط (مثل الوصفات)
            updateData.userImage = req.file.filename;
        }

        const updatedUser = await UserModel.findByIdAndUpdate(
            req.userId, 
            updateData, 
            { new: true } 
        ).select('-password');

        res.json({ message: "Profile Updated Successfully! ✨", user: updatedUser });

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Error updating profile" });
    }
});


// 5. جلب كل المستخدمين (للعرض في الصفحة الرئيسية)
router.get('/all-users', verifyToken, async (req, res) => {
  try {
    // بنجيب كل اليوزرز ما عدا اللي طالب الطلب (أنا) وبس بنختار الاسم والصورة
    const users = await UserModel.find({ _id: { $ne: req.userId } }).select('username userImage');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Error fetching users" });
  }
});

module.exports = router;