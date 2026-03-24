import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import admin from "firebase-admin";
import serviceAccount from "./serviceAccountKey.json" assert { type: "json" };

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const app = express();
app.use(cors());
app.use(express.json());

// Email using environment variables
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER, // set this in Render dashboard
    pass: process.env.GMAIL_PASS  // set this in Render dashboard
  }
});

app.post("/saveMarks", async (req, res) => {
  try {
    const { studentName, exam, subject, marks, total, teacherId, className, parentEmail } = req.body;
    const percentage = (marks / total) * 100;

    const querySnap = await db.collection("results")
      .where("name", "==", studentName)
      .where("exam", "==", exam)
      .where("subject", "==", subject)
      .where("class", "==", className)
      .get();

    if (!querySnap.empty) {
      querySnap.forEach(async (doc) => {
        await doc.ref.update({
          marks, total, percentage, teacherId, class: className, timestamp: new Date()
        });
      });
    } else {
      await db.collection("results").add({
        name: studentName,
        exam,
        subject,
        marks,
        total,
        percentage,
        teacherId,
        class: className,
        timestamp: new Date()
      });
    }

    if (parentEmail) {
      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: parentEmail,
        subject: `Results for ${studentName} (${exam})`,
        text: `Hello, ${studentName} scored ${marks}/${total} (${percentage.toFixed(2)}%) in ${subject} for ${exam}.`
      });
    }

    res.json({ success: true, percentage: percentage.toFixed(2) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
