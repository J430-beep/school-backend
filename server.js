import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";

const app = express();
app.use(cors());
app.use(express.json());

// 🔐 EMAIL CONFIG (PUT YOUR EMAIL HERE)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "iranduxavier6@gmail.com",
    pass: "ygkginaupdrneciw"
  }
});

// 📩 SEND RESULTS
app.post("/send-results", async (req, res) => {
  const { parentEmail, studentName, exam, results } = req.body;

  try {
    let message = `Results for ${studentName} (${exam}):\n\n`;

    results.forEach(r => {
      message += `${r.subject}: ${r.marks}/${r.total} (${Math.round(r.percentage)}%)\n`;
    });

    await transporter.sendMail({
      from: "iranduxavier6@gmail.com",
      to: parentEmail,
      subject: "Student Results",
      text: message
    });

    res.json({ success: true });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🌍 START SERVER
app.listen(3000, () => {
  console.log("Server running on port 3000");
});
