// ----------------- IMPORT FIREBASE -----------------
import { 
  getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject 
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-storage.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";

import { 
  getFirestore, collection, getDocs, query, where, addDoc, deleteDoc, doc, updateDoc 
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail 
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

// ----------------- FIREBASE CONFIG -----------------
const firebaseConfig = {
  apiKey: "AIzaSyD...",
  authDomain: "kipini-school-portal.firebaseapp.com",
  projectId: "kipini-school-portal",
  storageBucket: "kipini-school-portal.firebasestorage.app",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// ----------------- GLOBAL VARIABLES -----------------
let currentStudentName = "";
let currentStudentClass = "";
let currentTeacherUid = "";

const subjects = ["Math","Eng","Kiswa","CRE","S/S","INT/Sci","PRE-TECH","C.A/P.E","Agri"];

// ----------------- UI HELPERS -----------------
function hideElements(elements){
  elements.forEach(el=>{
    if(el){
      el.classList.add("hidden");
      el.style.display="none";
    }
  });
}

function showElement(el){
  if(!el) return;
  el.classList.remove("hidden");
  el.style.display="block";
}

// ----------------- NAVIGATION -----------------
window.showPage = id=>{
  ["home","portal","gallerySection","videoSection"].forEach(s=>{
    const el=document.getElementById(s);
    if(el) el.style.display="none";
  });
  showElement(document.getElementById(id));
};

window.showLogin = role=>{
  showPage("portal");
  hideElements([
    document.getElementById('studentLogin'),
    document.getElementById('teacherLogin'),
    document.getElementById('studentDashboard'),
    document.getElementById('teacherDashboard')
  ]);
  if(role==="student") showElement(document.getElementById("studentLogin"));
  if(role==="teacher") showElement(document.getElementById("teacherLogin"));
};

// ----------------- STUDENT LOGIN -----------------
window.loginStudent = async ()=>{
  const name = document.getElementById('loginName').value.trim().toLowerCase();
  const year = document.getElementById('loginYear').value.trim();

  const snap = await getDocs(collection(db,'students'));

  let found=null;
  snap.forEach(doc=>{
    const d=doc.data();
    if(d.name?.toLowerCase()===name && d.year==year){
      found=d;
    }
  });

  if(found){
    currentStudentName = found.name;
    currentStudentClass = found.class;

    document.getElementById('studentWelcome').innerText =
      `Welcome ${found.name} (${found.class})`;

    showElement(document.getElementById('studentDashboard'));
    hideElements([document.getElementById('studentLogin')]);

  }else{
    alert("Student not found");
  }
};

// ----------------- CLASS RESULTS + RANKING -----------------
window.loadClassResults = async ()=>{
  const className = document.getElementById('classSelect').value;
  const exam = document.getElementById('examSelect').value;
  const div = document.getElementById('classResults');

  if(!className || !exam){
    div.innerHTML="<p>Select class & exam</p>";
    return;
  }

  const studentsSnap = await getDocs(
    query(collection(db,'students'), where('class','==',className))
  );

  const resultsSnap = await getDocs(collection(db,'results'));

  let students=[];

  studentsSnap.forEach(s=>{
    let total=0;
    let count=0;

    resultsSnap.forEach(r=>{
      const data=r.data();
      if(data.name===s.data().name && data.exam===exam){
        total += Number(data.percentage || data.marks || 0);
        count++;
      }
    });

    students.push({
      name:s.data().name,
      total,
      mean: count ? Math.round(total/count) : 0
    });
  });

  // SORT + POSITION
  students.sort((a,b)=>b.total-a.total);

  let lastTotal=null;
  let pos=0;

  students.forEach((s,i)=>{
    if(s.total!==lastTotal) pos=i+1;
    s.position=pos;
    lastTotal=s.total;
  });

  let html=`<table border="1">
    <tr><th>Pos</th><th>Name</th><th>Total</th><th>Mean</th></tr>`;

  students.forEach(s=>{
    html+=`<tr>
      <td>${s.position}</td>
      <td>${s.name}</td>
      <td>${s.total}</td>
      <td>${s.mean}</td>
    </tr>`;
  });

  html+="</table>";
  div.innerHTML=html;
};

// ----------------- FULLSCREEN MEDIA -----------------
window.openMedia = (src,type)=>{
  const modal=document.getElementById("mediaModal");
  const content=document.getElementById("modalContent");

  modal.style.display="flex";

  if(type==="video"){
    content.innerHTML=`<video src="${src}" controls style="max-width:90%"></video>`;
  }else{
    content.innerHTML=`<img src="${src}" style="max-width:90%">`;
  }
};

window.closeMedia = ()=>{
  document.getElementById("mediaModal").style.display="none";
};

// ----------------- LOAD GALLERY -----------------
window.loadGallery = async ()=>{
  const container=document.getElementById('galleryContainer');
  container.innerHTML="Loading...";

  const snap = await getDocs(collection(db,'gallery'));

  container.innerHTML="";

  snap.forEach(doc=>{
    const d=doc.data();

    if(d.type==="video"){
      container.innerHTML += `
        <video src="${d.url}" width="200"
        onclick="openMedia('${d.url}','video')"></video>`;
    }else{
      container.innerHTML += `
        <img src="${d.url}" width="200"
        onclick="openMedia('${d.url}','image')">`;
    }
  });
};

// ----------------- LOAD VIDEOS -----------------
window.loadVideos = async ()=>{
  const container=document.getElementById('videoContainer');
  container.innerHTML="Loading...";

  const snap = await getDocs(collection(db,'gallery'));

  container.innerHTML="";

  snap.forEach(doc=>{
    const d=doc.data();
    if(d.type!=="video") return;

    container.innerHTML += `
      <video src="${d.url}" width="250" controls></video>
      <p>${d.caption||""}</p>`;
  });
};

// ----------------- SAVE MARKS (FIXED) -----------------
window.saveMarks = async ()=>{
  const studentName = document.getElementById('marksStudentSelect').value;
  const exam = document.getElementById('marksExamSelect').value;

  if(!studentName || !exam){
    alert("Select student & exam");
    return;
  }

  for(let sub of subjects){

    const pp1 = Number(document.getElementById(`${sub}_pp1`)?.value || 0);
    const pp1Total = Number(document.getElementById(`${sub}_pp1_total`)?.value || 0);

    const pp2 = Number(document.getElementById(`${sub}_pp2`)?.value || 0);
    const pp2Total = Number(document.getElementById(`${sub}_pp2_total`)?.value || 0);

    const pp3 = Number(document.getElementById(`${sub}_pp3`)?.value || 0);
    const pp3Total = Number(document.getElementById(`${sub}_pp3_total`)?.value || 0);

    const totalMarks = pp1+pp2+pp3;
    const totalTotal = pp1Total+pp2Total+pp3Total;
    const percentage = totalTotal ? (totalMarks/totalTotal)*100 : 0;

    await addDoc(collection(db,'results'),{
      name:studentName,
      subject:sub,
      exam,
      marks:totalMarks,
      total:totalTotal,
      percentage,
      teacherId:currentTeacherUid,
      timestamp:new Date()
    });
  }

  alert("Marks saved successfully!");
};

// ----------------- INIT -----------------
window.addEventListener('DOMContentLoaded',()=>{
  document.body.style.display='block';
  showPage('home');

  document.getElementById("closeMediaModal")?.addEventListener("click",window.closeMedia);
});
