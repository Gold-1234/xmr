import express from "express";
const router = express.Router();

let users = {};  // store emails + OTP temporarily

// Login / Signup
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: "Missing fields" });

  // For now, any email/password is accepted
  const user = {
    id: email + "-123",
    email,
  };

  return res.json({ user });
});

// OTP simulation
router.post("/send-otp", (req, res) => {
  const { email } = req.body;
  const otp = "123456"; // static demo OTP

  users[email] = otp;

  console.log("OTP sent →", otp);
  res.json({ message: "OTP sent successfully" });
});

router.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  if (users[email] !== otp) {
    return res.status(400).json({ message: "Invalid OTP" });
  }
  return res.json({ message: "OTP verified" });
});

export default router;
