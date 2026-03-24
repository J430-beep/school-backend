// server.js
import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import admin from "firebase-admin";

// ----------------- FIREBASE ADMIN -----------------
if (!process.env.GCP_JSON) {
  throw new Error("GCP_JSON environment variable not set in Render!");
}

// Parse JSON and fix escaped newlines
const serviceAccount = JSON.parse(process.env.GCP_JSON.replace(/\\n/g, "\n"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ----------------- EXPRESS SETUP -----------------
const app = express();
app.use(cors());
app.use(express.json());

// ----------------- EMAIL SETUP -----------------
if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
  throw new Error("GMAIL_USER or GMAIL_PASS environment variables not set!");
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

// ================= SAVE MARKS =================
app.post("/saveMarks", async (req, res) => {
  try {
    const { studentName, exam, subject, marks, total, teacherId, className, parentEmail } = req.body;
    if (!studentName || !exam || !subject) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const percentage = (marks / total) * 100;

    const querySnap = await db.collection("results")
      .where("name", "==", studentName)
      .where("exam", "==", exam)
      .where("subject", "==", subject)
      .where("class", "==", className)
      .get();

    if (!querySnap.empty) {
      for (const doc of querySnap.docs) {
        await doc.ref.update({ marks, total, percentage, teacherId, class: className, timestamp: new Date() });
      }
    } else {
      await db.collection("results").add({ name: studentName, exam, subject, marks, total, percentage, teacherId, class: className, timestamp: new Date() });
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
    res.status(500).json({ success: false, message: err.message });
  }
});

// ================= SEND RESULTS TO PARENTS =================
app.post("/send-results", async (req, res) => {
  try {
    const { class: className, exam } = req.body;
    if (!className || !exam) return res.status(400).json({ success: false, message: "Missing class or exam" });

    const studentsSnap = await db.collection("students").where("class", "==", className).get();
    if (studentsSnap.empty) return res.json({ success: false, message: "No students found" });

    let sentCount = 0;

    for (const studentDoc of studentsSnap.docs) {
      const student = studentDoc.data();
      if (!student.parentEmail) continue;

      const resultsSnap = await db.collection("results")
        .where("name", "==", student.name)
        .where("exam", "==", exam)
        .get();

      if (resultsSnap.empty) continue;

      let message = `Results for ${student.name} (${exam}):\n\n`;
      resultsSnap.forEach(doc => {
        const r = doc.data();
        message += `${r.subject}: ${r.marks}/${r.total} (${r.percentage.toFixed(2)}%)\n`;
      });

      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: student.parentEmail,
        subject: `Results for ${student.name} (${exam})`,
        text: message
      });

      sentCount++;
    }

    res.json({ success: true, sentCount });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ================= START SERVER =================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
