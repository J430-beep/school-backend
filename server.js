import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

const app = express();
app.use(cors());
app.use(express.json());

// Firebase setup
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "iranduxavier6@gmail.com",
    pass: "ygkginaupdrneciw" // app password
  }
});

// Send results endpoint
app.post("/send-results", async (req, res) => {
  const { class: className, exam } = req.body;

  try {
    const studentsSnap = await getDocs(query(collection(db, "students"), where("class", "==", className)));
    if (studentsSnap.empty) {
      return res.json({ success: false, sentCount: 0, message: "No students found in this class" });
    }

    let sentCount = 0;

    for (const studentDoc of studentsSnap.docs) {
      const student = studentDoc.data();
      if (!student.parentEmail) continue;

      // Fetch results for this student & exam
      const resultsSnap = await getDocs(
        query(collection(db, "results"), where("name", "==", student.name), where("exam", "==", exam))
      );

      if (resultsSnap.empty) continue;

      // Build email
      let message = `Results for ${student.name} (${exam}):\n\n`;
      resultsSnap.forEach(r => {
        const data = r.data();
        message += `${data.subject}: ${data.marks}/${data.total} (${Math.round(data.percentage)}%)\n`;
      });

      try {
        await transporter.sendMail({
          from: "iranduxavier6@gmail.com",
          to: student.parentEmail,
          subject: `Results for ${student.name} - ${exam}`,
          text: message
        });
        sentCount++;
      } catch (emailErr) {
        console.error("Failed to send email to", student.parentEmail, emailErr.message);
      }
    }

    if (sentCount === 0) {
      res.json({ success: false, sentCount: 0, message: "No parents had emails or sending failed" });
    } else {
      res.json({ success: true, sentCount, message: `Results sent to ${sentCount} parents` });
    }

  } catch (err) {
    console.error(err);
    res.json({ success: false, sentCount: 0, message: err.message });
  }
});

app.listen(3000, () => console.log("Server running on port 3000"));
