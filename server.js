import fs from "fs";
import admin from "firebase-admin";
import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";

// Step 1: Write the JSON file from Render environment variable
fs.writeFileSync("serviceAccountKey.json", process.env.GCP_JSON);

// Step 2: Load Firebase service account
// Read JSON from file
const serviceAccount = JSON.parse(fs.readFileSync("serviceAccountKey.json", "utf-8"));

// Step 3: Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();
app.use(cors());
app.use(express.json());

// ✅ Email setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

// ================= SAVE MARKS =================
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
          marks,
          total,
          percentage,
          teacherId,
          class: className,
          timestamp: new Date()
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

// ================= SEND RESULTS TO PARENTS =================
app.post("/send-results", async (req, res) => {
  try {
    const { class: className, exam } = req.body;

    if (!className || !exam) {
      return res.json({ success: false, message: "Missing class or exam" });
    }

    const studentsSnap = await db.collection("students")
      .where("class", "==", className)
      .get();

    if (studentsSnap.empty) {
      return res.json({ success: false, message: "No students found" });
    }

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
    res.json({ success: false, message: err.message });
  }
});

// ================= START SERVER =================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
