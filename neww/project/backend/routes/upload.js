import express from "express";
import multer from "multer";
import path from "path";

const router = express.Router();

// storage setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const name = Date.now() + ext;
    cb(null, name);
  },
});

const upload = multer({ storage });

// Upload API
router.post("/", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  const fileUrl = `http://localhost:5000/uploads/${req.file.filename}`;

  // Fake extraction for now
  const fakeTests = [
    "CBC",
    "CRP",
    "Blood Sugar",
    "Cholesterol",
    "Vitamin D"
  ];

  return res.json({
    fileUrl,
    tests: fakeTests,
  });
});

export default router;
