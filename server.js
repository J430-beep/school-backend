import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDqFbsXJr8G0r_9ppNLYGbsCBGZJdQ4BqA",
  authDomain: "kipini-school-portal.firebaseapp.com",
  projectId: "kipini-school-portal",
  storageBucket: "kipini-school-portal.appspot.com",
  messagingSenderId: "633954688245",
  appId: "1:633954688245:web:72ca52641fb9716ab679bc"
};

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

// Email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.iranduxavier6@gmail.com, 
    pass: process.ygkqinaupdrneciw
  }
});

// Send results
app.post("/send-results", async (req, res) => {
  const { class: className, exam } = req.body;
  if (!className || !exam) return res.status(400).json({ success:false, sentCount:0, message:"Class or exam missing" });

  try {
    const studentsSnap = await getDocs(query(collection(db, "students"), where("class", "==", className)));
    if (studentsSnap.empty) return res.json({ success:false, sentCount:0, message:"No students found" });

    let sentCount = 0, failed = [];

    for (const studentDoc of studentsSnap.docs) {
      const student = studentDoc.data();
      if (!student.parentEmail) { failed.push({student:student.name, reason:"No parent email"}); continue; }

      const resultsSnap = await getDocs(query(collection(db,"results"), where("name","==",student.name), where("exam","==",exam)));
      if (resultsSnap.empty) { failed.push({student:student.name, reason:"No results found"}); continue; }

      let message = `Results for ${student.name} (${exam}):\n\n`;
      resultsSnap.forEach(r => { const data=r.data(); message+=`${data.subject}: ${data.marks}/${data.total} (${Math.round(data.percentage)}%)\n`; });

      try {
        await transporter.sendMail({ from: process.iranduxavier6@gmail.com, to: student.parentEmail, subject:`Results for ${student.name} (${exam})`, text:message });
        sentCount++;
      } catch(e) { failed.push({student:student.name, reason:"Email send failed"}); }
    }

    res.json({ success:true, sentCount, failed });
  } catch(err) {
    res.status(500).json({ success:false, sentCount:0, message: err.message || "Unknown error" });
  }
});

app.listen(PORT, ()=>console.log(`Server running on port ${PORT}`));
