import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import { getDocs, collection, query, where } from "firebase/firestore";
import { db } from "./firebase.js"; // your Firebase initialization

const app = express();
app.use(cors());
app.use(express.json());

// 🔐 Email config
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "iranduxavier6@gmail.com",
    pass: "ygkginaupdrneciw"
  }
});

// 📩 Send results to all parents
app.post("/send-results", async (req, res) => {
  const { class: className, exam } = req.body;

  if (!className || !exam) {
    return res.json({ success: false, sentCount: 0, message: "Class or exam missing" });
  }

  try {
    const studentsSnap = await getDocs(
      query(collection(db, "students"), where("class", "==", className))
    );

    if (studentsSnap.empty) {
      return res.json({ success: false, sentCount: 0, message: "No students found" });
    }

    let sentCount = 0;

    for (const studentDoc of studentsSnap.docs) {
      const student = studentDoc.data();
      if (!student.parentEmail) continue;

      const resultsSnap = await getDocs(
        query(collection(db, "results"),
          where("name", "==", student.name),
          where("exam", "==", exam))
      );

      if (resultsSnap.empty) continue;

      // Build email content
      let message = `Results for ${student.name} (${exam}):\n\n`;
      resultsSnap.forEach(r => {
        const data = r.data();
        message += `${data.subject}: ${data.marks}/${data.total} (${Math.round(data.percentage)}%)\n`;
      });

      // Send email
      await transporter.sendMail({
        from: "iranduxavier6@gmail.com",
        to: student.parentEmail,
        subject: "Student Results",
        text: message
      });

      sentCount++;
    }

    if (sentCount === 0) {
      res.json({ success: false, sentCount: 0, message: "No parents with results to send" });
    } else {
      res.json({ success: true, sentCount });
    }

  } catch (err) {
    console.error(err);
    res.json({ success: false, sentCount: 0, message: err.message });
  }
});

// 🌍 Start server
app.listen(process.env.PORT || 3000, () => {
  console.log("Server running...");
});
