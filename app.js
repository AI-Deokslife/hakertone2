// ===================================================
// 우리 반 담벼락 - Firebase Firestore 연동
//
// 메모를 쓰면 올린 순서대로 담벼락에 붙습니다.
// Firestore 데이터베이스에 저장되어 새로고침해도 유지됩니다.
// ===================================================

// Firebase SDK 모듈 불러오기 (CDN 방식)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyAzCJ2QJn3gEZZGfh171HiZiHfl5ydz6-Q",
  authDomain: "deokslife1.firebaseapp.com",
  projectId: "deokslife1",
  storageBucket: "deokslife1.firebasestorage.app",
  messagingSenderId: "468423332681",
  appId: "1:468423332681:web:e934f349916f4d0c464098",
  measurementId: "G-YNCT74MKJE"
};

// Firebase 초기화 및 Firestore/Auth 연결
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const memosCol = collection(db, "memos");

const auth = getAuth(app);
const provider = new GoogleAuthProvider();
let currentUser = null; // 현재 로그인한 사용자 정보


// ===================================================
// 데이터를 다루는 함수 세 개
// Firestore를 사용해 데이터를 읽고, 쓰고, 지웁니다.
// ===================================================

// 메모를 읽어 옵니다.
// Firestore의 memos 컬렉션에서 작성 시각(createdAt) 순으로 정렬하여 가져옵니다.
async function loadMemos() {
  const q = query(memosCol, orderBy("createdAt", "asc"));
  const querySnapshot = await getDocs(q);
  const result = [];
  querySnapshot.forEach(function (docSnap) {
    result.push({
      id: docSnap.id,
      ...docSnap.data()
    });
  });
  return result;
}

// 메모를 새로 씁니다.
// 백엔드 2: 여기에 "누가 썼는지"(uid)를 함께 저장하게 됩니다.
async function addMemo(text) {
  if (!currentUser) {
    alert("로그인 후 메모를 작성할 수 있습니다.");
    return;
  }
  await addDoc(memosCol, {
    text: text,
    createdAt: Date.now(),
    uid: currentUser.uid,
    author: currentUser.displayName || "작성자"
  });
}

// 메모를 지웁니다.
// 백엔드 2: 지금은 누구든 남의 메모를 지울 수 있습니다. 이걸 막는 것이 과제입니다.
async function deleteMemo(id) {
  await deleteDoc(doc(db, "memos", id));
}


// ===================================================
// 화면 그리기
// ===================================================

async function render() {
  const wall = document.getElementById("wall");
  wall.innerHTML = "";

  const memos = await loadMemos();
  memos.forEach(function (memo) {
    wall.appendChild(makeMemo(memo));
  });
}

// 메모 한 장 만들기
function makeMemo(memo) {
  const div = document.createElement("div");
  div.className = "memo";

  // 본인이 작성한 메모이거나, uid 정보가 없는 기존 메모인 경우에만 삭제(×) 버튼 표시
  const canDelete = !memo.uid || (currentUser && currentUser.uid === memo.uid);
  if (canDelete) {
    const del = document.createElement("button");
    del.textContent = "×";
    del.addEventListener("click", async function () {
      await deleteMemo(memo.id);
      await render();
    });
    div.appendChild(del);
  }

  const span = document.createElement("span");
  span.textContent = memo.text;
  div.appendChild(span);

  // 작성자 정보가 있으면 표시
  if (memo.author) {
    const authorDiv = document.createElement("div");
    authorDiv.className = "memo-author";
    authorDiv.textContent = memo.author;
    div.appendChild(authorDiv);
  }

  return div;
}


// ===================================================
// 로그인 기능 (Firebase Authentication - Google)
// ===================================================

const userArea = document.getElementById("userArea");

// Google 로그인 창 열기
async function login() {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("로그인 실패:", error);
    alert("로그인에 실패했습니다: " + error.message);
  }
}

// 로그아웃
async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("로그아웃 실패:", error);
  }
}

// 상단 로그인 영역 그리기
function renderUserArea(user) {
  userArea.innerHTML = "";

  if (user) {
    const info = document.createElement("span");
    info.textContent = `${user.displayName || "사용자"}님 환영합니다!`;
    userArea.appendChild(info);

    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "로그아웃";
    logoutBtn.addEventListener("click", logout);
    userArea.appendChild(logoutBtn);
  } else {
    const loginBtn = document.createElement("button");
    loginBtn.textContent = "Google로 로그인";
    loginBtn.addEventListener("click", login);
    userArea.appendChild(loginBtn);
  }
}

// 로그인 상태 변경 감지 (초기 로드 및 로그인/로그아웃 시 자동 실행)
onAuthStateChanged(auth, function (user) {
  currentUser = user;
  renderUserArea(user);
  render(); // 로그인 상태가 바뀌면 본인 메모 삭제 버튼 노출 여부 다시 그리기
});


// ===================================================
// 메모 쓰는 칸
// 엔터를 누르면 담벼락에 붙습니다 (줄바꿈은 Shift + 엔터)
// ===================================================

const input = document.getElementById("input");

input.addEventListener("keydown", async function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();

    const text = input.value.trim();
    if (text === "") return;

    if (!currentUser) {
      alert("로그인 후 메모를 작성할 수 있습니다.");
      return;
    }

    input.value = "";
    await addMemo(text);
    await render();
  }
});


// 첫 화면 그리기
render();
input.focus();

