require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const userRouter = require('./routes/users');
const recipesRouter = require('./routes/recipes');
const notesRouter = require('./routes/notes');
const app = express();

app.use(express.json());
app.use(cors());
app.use('/auth', userRouter);
app.use('/uploads', express.static('uploads'));
app.use('/recipes', recipesRouter);
app.use('/notes', notesRouter);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected Successfully'))
  .catch((err) => console.error('❌ MongoDB Connection Failed:', err));

app.get('/', (req, res) => {
  res.send('API is running... Welcome to Recipe App Server! 🍳');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port: ${PORT}`);
});