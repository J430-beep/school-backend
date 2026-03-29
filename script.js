// ----------------- IMPORT FIREBASE -----------------
import { 
  getStorage, 
  ref, 
  uploadBytesResumable, 
  getDownloadURL,
  deleteObject 
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-storage.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";

import { 
  getFirestore, 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy,       // <-- ADD THIS
  addDoc,
  deleteDoc,
  doc,
  updateDoc     // <-- COMBINE updateDoc here
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail 
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
// ----------------- FIREBASE CONFIG -----------------
const firebaseConfig = {
  apiKey: "AIzaSyDqFbsXJr8G0r_9ppNLYGbsCBGZJdQ4BqA",
  authDomain: "kipini-school-portal.firebaseapp.com",
  projectId: "kipini-school-portal",
    storageBucket: "kipini-school-portal.firebasestorage.app",
  messagingSenderId: "633954688245",
  appId: "1:633954688245:web:72ca52641fb9716ab679bc"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// ----------------- GLOBAL VARIABLES -----------------
let currentStudentName = "";
let currentStudentClass = "";
let currentTeacherUid = "";
const subjects = ["Math", "Eng", "Kiswa", "CRE", "S/S", "INT/Sci", "PRE-TECH", "C.A/P.E", "Agri"];

// ----------------- HELPER FUNCTIONS -----------------
function hideElements(elements){ 
  elements.forEach(el => { 
    if(el){ el.classList.remove('fade-in'); el.classList.add('hidden'); el.style.display='none'; } 
  }); 
}
function showElement(el){ 
  if(!el) return; 
  el.classList.remove('hidden'); 
  el.classList.add('fade-in'); 
  el.style.display='block'; 
}

window.showPage = id => {
  ['home','portal','gallerySection','videoSection'].forEach(s => hideElements([document.getElementById(s)]));
  showElement(document.getElementById(id));
};

window.showLogin = role => {
  showPage('portal');
  hideElements([
    document.getElementById('studentLogin'),
    document.getElementById('teacherLogin'),
    document.getElementById('studentDashboard'),
    document.getElementById('teacherDashboard')
  ]);
  if(role==='student') showElement(document.getElementById('studentLogin'));
  if(role==='teacher') showElement(document.getElementById('teacherLogin'));
};

window.setActiveButton = (btn) => {
  document.querySelectorAll('.nav-right button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
};

// ----------------- STUDENT LOGIN -----------------
window.loginStudent = async () => {
  const inputName = document.getElementById('loginName').value.trim().toLowerCase();
  const inputYear = document.getElementById('loginYear').value.trim();
  const msg = document.getElementById('msg');
  msg.style.color='red';
  if(!inputName||!inputYear){ msg.innerText="Fill all fields"; return; }

  try{
    const snap = await getDocs(collection(db,'students'));
    let found=null;
    snap.forEach(doc=>{
      const data = doc.data();
      if(data.name && data.year &&
         data.name.trim().toLowerCase() === inputName &&
         data.year.toString().trim() === inputYear) found = data;
    });

    if(found){ 
      msg.style.color='green'; 
      msg.innerText="Login successful"; 
      currentStudentName = found.name;
      currentStudentClass = found.class;
      document.getElementById('studentWelcome').innerText = `Welcome, ${found.name} (${found.class})`;
      hideElements([document.getElementById('studentLogin')]);
      showElement(document.getElementById('studentDashboard'));
    } else msg.innerText="Student not found";
  } catch(e){
    console.error(e);
    msg.innerText="Error: "+e.message; 
  }
};
// ----------------- LOAD STUDENT RESULTS -----------------
window.loadStudentResults = async () => {
  const name = currentStudentName;
  const exam = document.getElementById('studentExamSelect').value.trim();
  const resultsDiv = document.getElementById('studentResultsDashboard');

  if (!name) {
    resultsDiv.innerHTML = '<p style="color:red">Student not logged in.</p>';
    return;
  }

  if (!exam) {
    resultsDiv.innerHTML = '<p style="color:red">Select an exam.</p>';
    return;
  }

  resultsDiv.innerHTML = 'Loading results...';

  try {
    const q = query(
      collection(db, "results"),
      where("name", "==", name),
      where("exam", "==", exam),
      orderBy("timestamp", "desc")  // Newest first
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      resultsDiv.innerHTML = '<p style="color:red">No results found.</p>';
      return;
    }

    let html = `
      <table>
        <tr>
          <th>Subject</th>
          <th>Marks</th>
          <th>Total</th>
          <th>%</th>
        </tr>
    `;

    let totalPercent = 0;
    let count = 0;

    snap.forEach(doc => {
      const r = doc.data();
      html += `
        <tr>
          <td>${r.subject}</td>
          <td>${r.marks}</td>
          <td>${r.total}</td>
          <td>${Math.round(parseFloat(r.percentage))}</td>
        </tr>
      `;
      totalPercent += parseFloat(r.percentage);
      count++;
    });

    const mean = count > 0 ? (totalPercent / count).toFixed(2) : "0.00";

    html += `
      <tr>
        <td colspan="3"><strong>Mean %</strong></td>
        <td>${mean}</td>
      </tr>
      </table>
    `;

    resultsDiv.innerHTML = html;

  } catch (error) {
    console.error(error);
    resultsDiv.innerHTML = `<p style="color:red">Error: ${error.message}</p>`;
  }
};

// ----------------- LOAD & EDIT CLASS RESULTS -----------------
window.loadClassResults = async () => {
  const className = document.getElementById('classSelect').value;
  const exam = document.getElementById('examSelect').value;
  const resultsDiv = document.getElementById('classResults');

  if (!className || !exam) {
    resultsDiv.innerHTML = "<p style='color:red'>Select class and exam</p>";
    return;
  }

  resultsDiv.innerHTML = "Loading results...";

  try {
    const studentsSnap = await getDocs(
      query(collection(db, 'students'), where('class', '==', className))
    );

    if (studentsSnap.empty) {
      resultsDiv.innerHTML = "<p style='color:red'>No students found</p>";
      return;
    }

    const resultsSnap = await getDocs(
      query(collection(db, 'results'), orderBy('timestamp', 'desc')) // newest first
    );

    let allStudents = [];
    let subjectTotals = {};
    let subjectCounts = {};

    // Initialize subject totals
    subjects.forEach(sub => {
      subjectTotals[sub] = 0;
      subjectCounts[sub] = 0;
    });

    // Build student data
    for (const studentDoc of studentsSnap.docs) {
      const student = studentDoc.data();
      const studentData = {
        name: student.name,
        subjects: {},
        total: 0,
        count: 0
      };

      resultsSnap.forEach(rDoc => {
        const r = rDoc.data();
        if (!r.percentage) return;
        if (r.name === student.name && r.exam === exam) {
          const perc = parseFloat(r.percentage);
          studentData.subjects[r.subject] = {
            percentage: perc,
            marks: r.marks,
            total: r.total,
            docRef: rDoc.ref
          };

          if (!isNaN(perc)) {
            studentData.total += perc;
            studentData.count++;

            subjectTotals[r.subject] += perc;
            subjectCounts[r.subject]++;
          }
        }
      });

      studentData.mean = studentData.count > 0
        ? (studentData.total / studentData.count).toFixed(2)
        : "0.00";

      allStudents.push(studentData);
    }

    // Function to render the table
    const renderTable = () => {
      // Sort students by total descending
      allStudents.sort((a, b) => b.total - a.total);

      let html = `<table border="1" cellpadding="5" cellspacing="0">
        <tr>
          <th>Pos</th>
          <th>Name</th>`;
      subjects.forEach(sub => html += `<th>${sub}</th>`);
      html += `<th>Total</th><th>Mean</th><th>Action</th></tr>`;

      let classTotalMean = 0;

      allStudents.forEach((s, index) => {
        html += `<tr>
          <td>${index + 1}</td>
          <td>${s.name}</td>`;
        subjects.forEach(sub => {
          const val = s.subjects[sub]?.percentage || 0;
          html += `<td>
            <input type="number" 
                   min="0" 
                   max="100" 
                   value="${Math.round(val)}"
                   style="width:60px" 
                   data-student="${s.name}" 
                   data-subject="${sub}">
          </td>`;
        });
        html += `<td>${Math.round(s.total)}</td>
                 <td>${Math.round(parseFloat(s.mean))}</td>`;
    
                 <td><button class="updateBtn" data-student="${s.name}">Update</button></td>
        </tr>`;
        classTotalMean += parseFloat(s.mean);
      });

      // Subject mean row (decimals)
      html += `<tr>
        <td colspan="2"><strong>Subject Mean</strong></td>`;
      subjects.forEach(sub => {
        const mean = (subjectCounts[sub] > 0) 
  ? Math.round(subjectTotals[sub] / subjectCounts[sub]) 
  : 0;
        html += `<td>${mean}</td>`;
      });
      html += `<td>-</td><td>-</td><td>-</td></tr>`;

      // Class mean row
    const classMean = (allStudents.length > 0)
  ? Math.round(classTotalMean / allStudents.length)
  : 0;
      html += `<tr>
        <td colspan="${subjects.length + 3}" style="text-align:center">
          <strong>Class Mean: ${classMean}</strong>
        </td>
      </tr>`;

      html += `</table>`;
      resultsDiv.innerHTML = html;

      // Add update functionality (single student)
      document.querySelectorAll('.updateBtn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const studentName = btn.dataset.student;
          try {
            const row = btn.closest('tr');
            let totalPerc = 0, count = 0;

            for (let sub of subjects) {
              const input = row.querySelector(`input[data-subject="${sub}"][data-student="${studentName}"]`);
              if (!input) continue;

              let val = parseFloat(input.value) || 0;
              if (val < 0) val = 0;
              if (val > 100) val = 100;

              totalPerc += val;
              count++;

              // Update Firestore
              const r = resultsSnap.docs.find(d => {
                const data = d.data();
                return data.name === studentName && data.exam === exam && data.subject === sub;
              }); 
              if (r) {
                await updateDoc(r.ref, { percentage: val, timestamp: new Date() });
              } else {
                await addDoc(collection(db, 'results'), {
                  name: studentName,
                  exam,
                  subject: sub,
                  marks: val,
                  total: 100,
                  percentage: val,
                  teacherId: currentTeacherUid,
                  timestamp: new Date()
                });
              }
            }

            const studentObj = allStudents.find(s => s.name === studentName);
            if (studentObj) {
              studentObj.total = totalPerc;
              studentObj.mean = (count > 0 ? Math.round(totalPerc / count) : 0);
              subjects.forEach(sub => {
                const val = parseFloat(row.querySelector(`input[data-subject="${sub}"][data-student="${studentName}"]`).value) || 0;
                studentObj.subjects[sub] = { percentage: val };
              });
            }

            alert(`Updated ${studentName}'s marks successfully!`);

            renderTable(); // Refresh table
          } catch (err) {
            console.error(err);
            alert('Error updating marks: ' + err.message);
          }
        });
      });

      // Update all students
      document.getElementById('updateAllBtn')?.addEventListener('click', async () => {
        try {
          for (const studentObj of allStudents) {
            let totalPerc = 0;
            let count = 0;

            for (let sub of subjects) {
              const input = document.querySelector(`input[data-student="${studentObj.name}"][data-subject="${sub}"]`);
              if (!input) continue;

              let val = parseFloat(input.value) || 0;
              if (val < 0) val = 0;
              if (val > 100) val = 100;

              totalPerc += val;
              count++;

              const existingQuery = query(
  collection(db, "results"),
  where("name", "==", studentObj.name),
  where("exam", "==", exam),
  where("subject", "==", sub)
);

const existingSnap = await getDocs(existingQuery);

if (!existingSnap.empty) {
  const docRef = existingSnap.docs[0].ref;

  await updateDoc(docRef, {
    percentage: val,
    marks: val,
    total: 100,
    timestamp: new Date()
  });

} else {
  await addDoc(collection(db, "results"), {
    name: studentObj.name,
    exam,
    subject: sub,
    marks: val,
    total: 100,
    percentage: val,
    teacherId: currentTeacherUid,
    timestamp: new Date()
  });
}

              studentObj.subjects[sub] = { percentage: val };
            }

            studentObj.total = totalPerc;
            studentObj.mean = (count > 0 ? Math.round(totalPerc / count) : 0);
          }

          alert("All students' marks updated successfully!");
          renderTable();
        } catch (err) {
          console.error(err);
          alert('Error updating all marks: ' + err.message);
        }
      });
    };

    renderTable(); // initial render

  } catch (err) {
    console.error(err);
    resultsDiv.innerHTML = `<p style="color:red">${err.message}</p>`;
  }
};

// ----------------- TEACHER LOGIN -----------------
window.loginTeacher = async () => {
  const email = document.getElementById('teacherName').value.trim();
  const password = document.getElementById('teacherPassword').value.trim();
  const msg = document.getElementById('msgTeacher');

  if(!email||!password){ msg.style.color='red'; msg.innerText="Fill all fields"; return; }

  try{
    const userCredential = await signInWithEmailAndPassword(auth,email,password);
    currentTeacherUid = userCredential.user.uid;
    hideElements([document.getElementById('teacherLogin')]);
    showElement(document.getElementById('teacherDashboard'));

    // Populate student dropdown
    const studentSelect = document.getElementById('marksStudentSelect');
    studentSelect.innerHTML = '<option value="">Select Student</option>';
    const snap = await getDocs(collection(db, 'students'));
    snap.forEach(doc => {
      const student = doc.data();
      const opt = document.createElement('option');
      opt.value = student.name;
      opt.innerText = `${student.name} (${student.class})`;
      studentSelect.appendChild(opt);
    });

    // Attach event listeners AFTER populating dropdowns
    studentSelect.addEventListener('change', generateSubjectInputs);
    document.getElementById('marksExamSelect').addEventListener('change', generateSubjectInputs);

    // Teacher welcome name
    const tSnap = await getDocs(collection(db,'teachers'));
    tSnap.forEach(doc => {
      const t = doc.data();
      if(t.uid===currentTeacherUid) document.getElementById('teacherWelcome').innerText="Welcome "+t.name;
    });

    msg.style.color='green'; msg.innerText="Login successful!";
  } catch(e){
    console.error(e);
    msg.style.color='red'; msg.innerText=e.message;
  }
};

// ----------------- ADD STUDENT -----------------
window.addStudent = async () => {
  const name = document.getElementById('newStudentName').value.trim();
  const cls = document.getElementById('newStudentClass').value.trim();
  const year = document.getElementById('newStudentYear').value.trim();
  const msg = document.getElementById('addStudentMsg');
  msg.style.color='red';
  if(!name || !cls || !year){ msg.innerText="Fill all fields"; return; }

  try{
    await addDoc(collection(db,'students'),{ name, class:cls, year, timestamp: new Date() });
    msg.style.color='green';
    msg.innerText="Student added successfully!";
    document.getElementById('newStudentName').value='';
    document.getElementById('newStudentClass').value='';
    document.getElementById('newStudentYear').value='';
  }catch(e){ msg.innerText="Error: "+e.message; }
};

// ----------------- GENERATE SUBJECT INPUTS -----------------
function generateSubjectInputs(){
  const student = document.getElementById('marksStudentSelect').value;
  const exam = document.getElementById('marksExamSelect').value;
  const container = document.getElementById('subjectsInputs');
  container.innerHTML=''; 
  if(!student || !exam) return;

  subjects.forEach(sub=>{
    const div = document.createElement('div');
    div.style.marginBottom='5px';
    div.innerHTML = `
      <label style="width:100px; display:inline-block;">${sub}:</label>
      PP1: <input type="number" id="${sub}_pp1" placeholder="Marks" min="0" style="width:50px;">
      <input type="number" id="${sub}_pp1_total" placeholder="Total" min="1" style="width:50px; margin-right:10px;">
      PP2: <input type="number" id="${sub}_pp2" placeholder="Marks" min="0" style="width:50px;">
      <input type="number" id="${sub}_pp2_total" placeholder="Total" min="1" style="width:50px; margin-right:10px;">
      PP3: <input type="number" id="${sub}_pp3" placeholder="Marks" min="0" style="width:50px;">
      <input type="number" id="${sub}_pp3_total" placeholder="Total" min="1" style="width:50px;">
    `;
    container.appendChild(div);
  });
}

// ----------------- SAVE / UPDATE MARKS (PP1+PP2+PP3) -----------------
window.saveMarks = async () => {
  const studentName = document.getElementById('marksStudentSelect').value;
  const exam = document.getElementById('marksExamSelect').value;
  const className = document.getElementById('marksClassSelect').value;
  const msg = document.getElementById('marksMsg');

  msg.style.color = 'red';

  if (!studentName || !exam || !className) {
    msg.innerText = "Select student, class, and exam";
    return;
  }

  try {
    for (let sub of subjects) {
      // Read PP1, PP2, PP3 marks and totals
      const pp1 = parseFloat(document.getElementById(`${sub}_pp1`)?.value) || 0;
      const pp1Total = parseFloat(document.getElementById(`${sub}_pp1_total`)?.value) || 0;
      const pp2 = parseFloat(document.getElementById(`${sub}_pp2`)?.value) || 0;
      const pp2Total = parseFloat(document.getElementById(`${sub}_pp2_total`)?.value) || 0;
      const pp3 = parseFloat(document.getElementById(`${sub}_pp3`)?.value) || 0;
      const pp3Total = parseFloat(document.getElementById(`${sub}_pp3_total`)?.value) || 0;

      const totalMarks = pp1 + pp2 + pp3;
      const totalTotal = pp1Total + pp2Total + pp3Total;
      const percentage = totalTotal > 0 ? Math.round((totalMarks / totalTotal) * 100) : 0;

      // Send to backend
      const response = await fetch('https://school-backend-5bed.onrender.com/saveMarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName,
          exam,
          subject: sub,
          marks: totalMarks,
          total: totalTotal,
          percentage,
          className,
          teacherId: currentTeacherUid,
          parentEmail: "" // Optional
        })
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.message || "Failed to save marks");
    }

    msg.style.color = 'green';
    msg.innerText = "Marks saved successfully!";

  } catch (err) {
    console.error(err);
    msg.innerText = "Error: " + err.message;
  }
};

// ----------------- SEND RESULTS TO PARENTS -----------------
window.sendResultsToParents = async () => {
  const className = document.getElementById('sendClass').value;
  const exam = document.getElementById('sendExam').value;
  const msg = document.getElementById('sendMsg');

  msg.style.color = "red";

  if (!className || !exam) {
    msg.innerText = "Select class and exam";
    return;
  }

  msg.innerText = "Sending results...";

  try {
    const response = await fetch('https://school-backend-5bed.onrender.com/send-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ class: className, exam })
    });

    const data = await response.json();

    if (data.success) {
      msg.style.color = "green";
      msg.innerText = `Results sent successfully to ${data.sentCount} parents!`;
    } else {
      msg.innerText = `No results sent: ${data.message || "Unknown error"}`;
    }

  } catch (err) {
    console.error(err);
    msg.innerText = "Error sending results: " + err.message;
  }
};

// ----------------- LOGOUT -----------------
window.logout = role => {
  if(role==='student'){ 
    hideElements([document.getElementById('studentDashboard')]); 
    showElement(document.getElementById('studentLogin')); 
  }
  else { 
    hideElements([document.getElementById('teacherDashboard')]); 
    showElement(document.getElementById('teacherLogin')); 
  }
};

// ----------------- PASSWORD RESET -----------------
document.getElementById('forgotPasswordLink').addEventListener('click', async e=>{
  e.preventDefault();
  const email = prompt("Enter your teacher email:");
  if(!email) return;
  try{ await sendPasswordResetEmail(auth,email); alert("Password reset link sent!"); }
  catch(err){ alert("Error: "+err.message); }
});

// ----------------- PASSWORD TOGGLE -----------------
document.getElementById('toggleTeacherPassword').addEventListener('click',()=>{
  const input=document.getElementById('teacherPassword');
  const toggle=document.getElementById('toggleTeacherPassword');
  if(input.type==='password'){ input.type='text'; toggle.innerText='Hide'; }
  else { input.type='password'; toggle.innerText='Show'; }
});

// ----------------- REGISTER TEACHER -----------------
window.registerTeacher = async () => {
  const name = document.getElementById('newTeacherName').value.trim();
  const email = document.getElementById('newTeacherEmail').value.trim();
  const password = document.getElementById('newTeacherPassword').value.trim();
  const msg = document.getElementById('addTeacherMsg');
  msg.style.color='red';
  if(!name || !email || !password){ msg.innerText="Fill all fields"; return; }

  try{
    const userCredential = await createUserWithEmailAndPassword(auth,email,password);
    const uid = userCredential.user.uid;
    await addDoc(collection(db,'teachers'),{ name,email,uid,timestamp:new Date() });
    msg.style.color='green';
    msg.innerText="Teacher registered successfully!";
    document.getElementById('newTeacherName').value='';
    document.getElementById('newTeacherEmail').value='';
    document.getElementById('newTeacherPassword').value='';
  }catch(e){ msg.innerText="Error: "+e.message; }
};

// ----------------- LOAD GALLERY -----------------
async function loadGallery() {
  const container = document.getElementById('galleryContainer');
  container.innerHTML = "Loading gallery...";

  try {
    const snap = await getDocs(collection(db, 'uploads'));
    if (snap.empty) {
      container.innerHTML = "<p>No files uploaded yet.</p>";
      return;
    }

    container.innerHTML = ''; // clear before adding

    snap.forEach(doc => {
      const data = doc.data();
      if (data.type === 'image') {
        const img = document.createElement('img');
        img.src = data.url;
        img.alt = data.title || '';
        img.className = 'mediaItem';
        img.dataset.type = 'image';
        img.dataset.caption = data.title || '';
        img.style.width = '150px';
        img.style.height = '100px';
        img.style.objectFit = 'cover';
        img.style.cursor = 'pointer';
        container.appendChild(img);
      }
    });

    enableFullscreenMedia(); // attach click events

  } catch (err) {
    console.error(err);
    container.innerHTML = `<p style="color:red">${err.message}</p>`;
  }
}

// ----------------- LOAD VIDEOS -----------------
async function loadVideos() {
  const container = document.getElementById('videoContainer');
  container.innerHTML = "Loading videos...";

  try {
    const snap = await getDocs(collection(db, 'uploads'));
    if (snap.empty) {
      container.innerHTML = "<p>No videos uploaded yet.</p>";
      return;
    }

    container.innerHTML = ''; // clear before adding

    snap.forEach(doc => {
      const data = doc.data();
      if (data.type === 'video') {
        const video = document.createElement('video');
        video.src = data.url;
        video.className = 'mediaItem';
        video.dataset.type = 'video';
        video.dataset.caption = data.title || '';
        video.style.width = '200px';
        video.style.height = '120px';
        video.style.objectFit = 'cover';
        video.style.cursor = 'pointer';
        container.appendChild(video);
      }
    });

    enableFullscreenMedia(); // attach click events

  } catch (err) {
    console.error(err);
    container.innerHTML = `<p style="color:red">${err.message}</p>`;
  }
}

// ----------------- INITIAL PAGE LOAD -----------------
window.addEventListener('DOMContentLoaded',()=>{
  document.body.style.display='block';
  showPage('home');
});
document.getElementById('fileUpload').addEventListener('change', () => {
  const file = document.getElementById('fileUpload').files[0];
  const preview = document.getElementById('previewContainer');
  preview.innerHTML = "";

  if (!file) return;

  if (file.type.startsWith('image')) {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.style.width = "150px";
    img.style.height = "100px";
    img.style.objectFit = "cover";
    preview.appendChild(img);
  } 
  else if (file.type.startsWith('video')) {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.controls = true;
    video.style.width = "150px";
    preview.appendChild(video);
  }
});

// ----------------- POPULATE STUDENTS BY CLASS -----------------
async function populateStudentsByClass() {
  const classSelect = document.getElementById('marksClassSelect');
  const studentSelect = document.getElementById('marksStudentSelect');

  // Clear student dropdown
  studentSelect.innerHTML = '<option value="">Select Student</option>';

  const selectedClass = classSelect.value;
  if (!selectedClass) return;

  try {
    const snap = await getDocs(
      query(collection(db, 'students'), where('class', '==', selectedClass))
    );

    if (snap.empty) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.innerText = 'No students found';
      studentSelect.appendChild(opt);
      return;
    }

    snap.forEach(doc => {
  const student = doc.data();
  const opt = document.createElement('option');
  opt.value = student.name;
  opt.innerText = `${student.name} (${student.class})`;
  studentSelect.appendChild(opt);
});

    // After populating students, generate subject inputs if exam is already selected
    generateSubjectInputs();

  } catch (err) {
    console.error(err);
    alert("Error loading students: " + err.message);
  }
}
document.getElementById('marksClassSelect').addEventListener('change', populateStudentsByClass);

// ------------------ UPLOAD FILE FUNCTION ------------------
window.uploadFile = () => {
  const file = document.getElementById('fileUpload').files[0];
  const title = document.getElementById('fileTitle').value.trim();
  const msg = document.getElementById('uploadMsg');
  const progressBar = document.getElementById('uploadProgressBar');

  msg.style.color = "red";
  msg.innerText = "";

  if (!file || !title) {
    msg.innerText = "Select file and enter title";
    return;
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "school_uploads");

  const xhr = new XMLHttpRequest();
  xhr.open("POST", "https://api.cloudinary.com/v1_1/dlzykdayo/auto/upload");

  // ✅ REAL PROGRESS
  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const percent = (e.loaded / e.total) * 100;
      if (progressBar) progressBar.style.width = percent + "%";
    }
  };

  xhr.onload = async () => {
    const data = JSON.parse(xhr.responseText);

    if (data.secure_url) {

      await addDoc(collection(db, 'gallery'), {
        title,
        url: data.secure_url,
        public_id: data.public_id, // 🔥 important
        type: file.type.startsWith('video') ? 'video' : 'image',
        uploadedBy: currentTeacherUid,
        timestamp: new Date()
      });

      msg.style.color = "green";
      msg.innerText = "Upload successful!";

      document.getElementById('fileUpload').value = "";
      document.getElementById('fileTitle').value = "";
      loadManageUploads();

    } else {
      msg.innerText = "Upload failed";
    }
  };

  xhr.onerror = () => {
    msg.innerText = "Upload error occurred";
  };

  xhr.send(formData);
};

// ------------------ LOAD / MANAGE UPLOADS ------------------
window.loadManageUploads = async () => {
  const container = document.getElementById('manageUploads');
  container.innerHTML = "Loading uploads...";

  try{
    const snap = await getDocs(collection(db, 'gallery'));
    if(snap.empty){
      container.innerHTML = "<p>No uploads yet.</p>";
      return;
    }

    container.innerHTML = "";
    snap.forEach(docSnap => {
      const data = docSnap.data();
      const div = document.createElement('div');
      div.style.border = "1px solid #ccc";
      div.style.padding = "5px";
      div.style.margin = "5px";
      div.style.width = "180px";
      div.style.display = "inline-block";
      div.style.textAlign = "center";

      if(data.type === 'image'){
        const img = document.createElement('img');
        img.src = data.url;
        img.style.width = "100%";
        img.style.height = "100px";
        img.style.objectFit = "cover";
        div.appendChild(img);
      } else if(data.type === 'video'){
        const video = document.createElement('video');
        video.src = data.url;
        video.controls = true;
        video.style.width = "100%";
        video.style.height = "100px";
        div.appendChild(video);
      }

      const title = document.createElement('p');
      title.innerText = data.title;
      div.appendChild(title);

      const delBtn = document.createElement('button');
      delBtn.innerText = "Delete";
      delBtn.style.marginTop = "5px";
      delBtn.onclick = async () => {
  if(!confirm(`Delete "${data.title}"?`)) return;

  try{
    // ✅ Delete only from Firestore
    await deleteDoc(doc(db, 'gallery', docSnap.id));

    // ✅ Reload UI
    loadManageUploads();

  } catch(err){
    console.error(err);
    alert("Error deleting file: " + err.message);
  }
};
      div.appendChild(delBtn);

      container.appendChild(div);
    });

  } catch(err){
    console.error(err);
    container.innerHTML = "<p style='color:red'>Error loading uploads: "+err.message+"</p>";
  }
};

// ------------------ AUTO LOAD ON TEACHER DASHBOARD ------------------
if(document.getElementById('teacherDashboard')){
  loadManageUploads();
}
function previewFile() {
    const file = document.getElementById("fileUpload").files[0];
    const caption = document.getElementById("fileTitle").value;
    const preview = document.getElementById("previewContainer");

    if (!file) {
        alert("Please select a file first");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        let content = "";
        if (file.type.startsWith("image/")) {
            content = `<img src="${e.target.result}" style="max-width:200px; display:block; margin-top:10px;">`;
        } else if (file.type.startsWith("video/")) {
            content = `<video src="${e.target.result}" controls style="max-width:300px; display:block; margin-top:10px;"></video>`;
        }
        content += `<p><strong>Caption:</strong> ${caption}</p>`;
        preview.innerHTML = content;
    };
    reader.readAsDataURL(file);
}



// -------------------- OPEN IMAGE OR VIDEO --------------------
function openMediaModal(src, type, caption) {
  const modal = document.getElementById("mediaModal");
  const content = document.getElementById("modalContent");
  const captionText = document.getElementById("modalCaption");

  content.innerHTML = ""; // clear previous content

  if (type === "image") {
    content.innerHTML = `<img src="${src}" style="max-width:90vw; max-height:80vh; border-radius:10px;">`;
  } else if (type === "video") {
    content.innerHTML = `<video src="${src}" controls autoplay style="max-width:90vw; max-height:80vh; border-radius:10px;"></video>`;
  }

  captionText.textContent = caption || "";
  modal.classList.remove("hidden");
}

// -------------------- CLOSE MODAL --------------------
const mediaModal = document.getElementById("mediaModal");
const closeBtn = document.getElementById("closeMediaModal");

closeBtn.onclick = () => {
  mediaModal.classList.add("hidden");
  document.getElementById("modalContent").innerHTML = "";
};

// Close modal when clicking outside content
mediaModal.onclick = (e) => {
  if (e.target === mediaModal) {
    mediaModal.classList.add("hidden");
    document.getElementById("modalContent").innerHTML = "";
  }
};

// Optional: global function for manual calls
window.openMedia = (url, type, caption) => openMediaModal(url, type, caption);

// -------------------- ATTACH CLICK TO ALL MEDIA ITEMS --------------------
function enableFullscreenMedia() {
  document.querySelectorAll(".mediaItem").forEach(item => {
    item.addEventListener("click", () => {
      const src = item.src || item.currentSrc;
      const type = item.dataset.type;
      const caption = item.dataset.caption;
      openMediaModal(src, type, caption);
    });
  });
}
