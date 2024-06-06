const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/pythonPlayground', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const FileSchema = new mongoose.Schema({
  filename: String,
  content: String
});

const File = mongoose.model('File', FileSchema);

// Routes
app.get('/files', async (req, res) => {
  const files = await File.find();
  res.json(files);
});

app.post('/files', async (req, res) => {
  const { filename, content } = req.body;
  const newFile = new File({ filename, content });
  await newFile.save();
  res.json(newFile);
});

app.put('/files/:id', async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  const updatedFile = await File.findByIdAndUpdate(id, { content }, { new: true });
  res.json(updatedFile);
});

app.delete('/files/:id', async (req, res) => {
  const { id } = req.params;
  await File.findByIdAndDelete(id);
  res.json({ message: 'File deleted' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
