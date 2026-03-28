// ----------------- FIREBASE -----------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { 
  getFirestore, collection, getDocs, query, where, addDoc 
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { 
  getAuth, signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

// CONFIG
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

// ----------------- GLOBALS -----------------
let currentStudentName = "";
let currentTeacher = "";

const subjects = ["Math","Eng","Kiswa","CRE","S/S","Sci","Agri"];

// ----------------- NAV -----------------
function hideAll(){
  document.querySelectorAll("section").forEach(s=>s.style.display="none");
}
function show(id){
  hideAll();
  document.getElementById(id).style.display="block";
}
window.showPage = id => show(id);

window.showLogin = role=>{
  show("portal");
  document.getElementById("studentLogin").style.display="none";
  document.getElementById("teacherLogin").style.display="none";
  document.getElementById(role+"Login").style.display="block";
};

// ----------------- STUDENT LOGIN -----------------
window.loginStudent = async ()=>{
  const name = loginName.value.trim().toLowerCase();
  const year = loginYear.value.trim();
  const msg = document.getElementById("msg");

  if(!name || !year){ msg.innerText="Fill all fields"; return; }

  const snap = await getDocs(collection(db,"students"));
  let found=null;

  snap.forEach(doc=>{
    const d=doc.data();
    if(d.name.toLowerCase()===name && d.year==year) found=d;
  });

  if(found){
    currentStudentName = found.name;
    msg.style.color="green";
    msg.innerText="Login success";

    studentLogin.style.display="none";
    studentDashboard.style.display="block";
    studentWelcome.innerText="Welcome "+found.name;
  }else{
    msg.innerText="Student not found";
  }
};

// ----------------- STUDENT RESULTS -----------------
window.loadStudentResults = async ()=>{
  const exam = studentExamSelect.value;
  const div = studentResultsDashboard;

  if(!exam){ div.innerHTML="Select exam"; return; }

  const q = query(
    collection(db,"results"),
    where("name","==",currentStudentName),
    where("exam","==",exam)
  );

  const snap = await getDocs(q);

  if(snap.empty){ div.innerHTML="No results"; return; }

  let total=0, count=0;
  let html="<table><tr><th>Subject</th><th>%</th></tr>";

  snap.forEach(doc=>{
    const r=doc.data();
    html+=`<tr><td>${r.subject}</td><td>${r.percentage}</td></tr>`;
    total+=parseFloat(r.percentage); count++;
  });

  html+=`<tr><td><b>Mean</b></td><td>${(total/count).toFixed(1)}</td></tr></table>`;
  div.innerHTML=html;
};

// ----------------- TEACHER LOGIN -----------------
window.loginTeacher = async ()=>{
  const email = teacherName.value;
  const pass = teacherPassword.value;
  const msg = msgTeacher;

  if(!email||!pass){ msg.innerText="Fill all fields"; return; }

  try{
    await signInWithEmailAndPassword(auth,email,pass);
    currentTeacher=email;

    msg.style.color="green";
    msg.innerText="Login success";

    teacherLogin.style.display="none";
    teacherDashboard.style.display="block";
  }catch(e){ msg.innerText=e.message; }
};

// ----------------- ADD STUDENT -----------------
window.addStudent = async ()=>{
  const name=newStudentName.value;
  const cls=newStudentClass.value;
  const year=newStudentYear.value;
  const msg=addStudentMsg;

  if(!name||!cls||!year){ msg.innerText="Fill all"; return; }

  await addDoc(collection(db,"students"),{name,class:cls,year});
  msg.style.color="green";
  msg.innerText="Added";
};

// ----------------- ENTER MARKS -----------------
window.saveMarks = async ()=>{
  const student = marksStudentSelect.value;
  const exam = marksExamSelect.value;

  if(!student||!exam){ alert("Select student & exam"); return; }

  for(let sub of subjects){
    const val = document.getElementById(sub).value || 0;

    await addDoc(collection(db,"results"),{
      name:student,
      exam,
      subject:sub,
      percentage:parseFloat(val)
    });
  }

  alert("Marks saved");
};

// ----------------- LOAD CLASS RESULTS + RANK -----------------
window.loadClassResults = async ()=>{
  const cls = classSelect.value;
  const exam = examSelect.value;
  const div = classResults;

  if(!cls||!exam){ div.innerHTML="Select class & exam"; return; }

  const studentsSnap = await getDocs(query(collection(db,"students"), where("class","==",cls)));
  const resultsSnap = await getDocs(collection(db,"results"));

  let students=[];

  studentsSnap.forEach(doc=>{
    const s=doc.data();
    let total=0,count=0;

    resultsSnap.forEach(rdoc=>{
      const r=rdoc.data();
      if(r.name===s.name && r.exam===exam){
        total+=parseFloat(r.percentage);
        count++;
      }
    });

    students.push({
      name:s.name,
      total:total,
      mean:count?total/count:0
    });
  });

  // SORT + RANK
  students.sort((a,b)=>b.total-a.total);

  let html="<table><tr><th>Pos</th><th>Name</th><th>Total</th><th>Mean</th></tr>";

  students.forEach((s,i)=>{
    html+=`<tr>
      <td>${i+1}</td>
      <td>${s.name}</td>
      <td>${s.total}</td>
      <td>${s.mean.toFixed(1)}</td>
    </tr>`;
  });

  html+="</table>";
  div.innerHTML=html;
};

// ----------------- GALLERY -----------------
window.loadGallery = async ()=>{
  const container = galleryContainer;
  container.innerHTML="Loading...";

  const snap = await getDocs(collection(db,"gallery"));
  container.innerHTML="";

  snap.forEach(doc=>{
    const d=doc.data();

    const el = document.createElement("img");
    el.src=d.url;
    el.style.width="200px";
    el.style.cursor="pointer";

    el.onclick=()=>openModal(d.url,"image");

    container.appendChild(el);
  });
};

// ----------------- VIDEOS -----------------
window.loadVideos = async ()=>{
  const container = videoContainer;
  container.innerHTML="Loading...";

  const snap = await getDocs(collection(db,"gallery"));
  container.innerHTML="";

  snap.forEach(doc=>{
    const d=doc.data();
    if(d.type!=="video") return;

    const vid=document.createElement("video");
    vid.src=d.url;
    vid.width=200;
    vid.onclick=()=>openModal(d.url,"video");

    container.appendChild(vid);
  });
};

// ----------------- FULLSCREEN MODAL -----------------
window.openModal = (url,type)=>{
  const modal = mediaModal;
  const content = modalContent;

  modal.style.display="flex";
  content.innerHTML="";

  if(type==="image"){
    content.innerHTML=`<img src="${url}" style="max-width:90%">`;
  }else{
    content.innerHTML=`<video src="${url}" controls autoplay style="max-width:90%"></video>`;
  }
};

closeMediaModal.onclick=()=>{
  mediaModal.style.display="none";
};

// ----------------- LOGOUT -----------------
window.logout = role=>{
  if(role==="student"){
    studentDashboard.style.display="none";
    studentLogin.style.display="block";
  }else{
    teacherDashboard.style.display="none";
    teacherLogin.style.display="block";
  }
};

// ----------------- INIT -----------------
window.addEventListener("DOMContentLoaded",()=>{
  document.body.style.display="block";
  show("home");
});
