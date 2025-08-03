// // src/index.ts
//
// import './styles.css';
// import { auth, db } from '@modules/firebase';
// import { onAuthStateChanged, signOut, User } from 'firebase/auth';
// import { doc, getDoc, setDoc } from 'firebase/firestore';
// import { VisionApp } from '@modules/vision';
// import { bindButton, showMessage } from '@modules/ui';
//
// window.addEventListener('DOMContentLoaded', async () => {
//   const authBtn     = document.getElementById('authBtn')     as HTMLButtonElement;
//   const recordBtn   = document.getElementById('recordBtn')   as HTMLAnchorElement;
//   const avatarImg   = document.getElementById('userAvatar')  as HTMLImageElement;
//   const welcomeText = document.getElementById('welcomeText') as HTMLElement;
//
//   // 1️⃣ 监听登录状态
//   // @ts-ignore
//   onAuthStateChanged(auth, async (user: User | null) => {
//     if (!user) {
//       // 未登录则跳回登录页
//       window.location.href = '/login.html';
//       return;
//     }
//
//     // 2️⃣ 确保 users/{uid} 文档存在，并写入正确的 role
//     const userRef  = doc(db, 'users', user.uid);
//     const userSnap = await getDoc(userRef);
//
//     // 每次登录都 merge 写入，确保角色正确
//     const isTeacher = user.email === 'steve.kerrison@jcu.edu.au';
//     await setDoc(userRef, {
//       email: user.email,
//       role:  isTeacher ? 'teacher' : 'student'
//     }, { merge: true });
//
//     // 3️⃣ 更新侧边栏头像
//     const seed = encodeURIComponent(user.email || '');
//     avatarImg.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${seed}`;
//     avatarImg.onerror = () => { avatarImg.src = '/assets/default-avatar.svg'; };
//
//     // 4️⃣ 只显示邮箱 @ 前的用户名
//     const rawEmail = user.email || '';
//     const nameOnly = rawEmail.split('@')[0];
//     welcomeText.textContent = `Welcome, ${nameOnly}`;
//
//     // 5️⃣ 登出按钮
//     authBtn.textContent = 'Logout';
//     authBtn.onclick = async () => {
//       await signOut(auth);
//       window.location.href = '/login.html';
//     };
//
//     // 6️⃣ 学习记录按钮：根据 role 跳到学生或教师界面
//     recordBtn.onclick = async e => {
//       e.preventDefault();
//       const snap2 = await getDoc(userRef);
//       const role  = snap2.exists() ? (snap2.data() as any).role : 'student';
//       window.location.href = role === 'teacher'
//           ? '/teacher_record.html'
//           : '/student_record.html';
//     };
//   });
//
//   // 7️⃣ AR 扫描 + Quiz 按钮逻辑（无改动）
//   const videoEl       = document.getElementById('video')      as HTMLVideoElement;
//   const captureCanvas = document.getElementById('capture')    as HTMLCanvasElement | null;
//   const overlayCanvas = document.getElementById('overlay')    as HTMLCanvasElement;
//   const captureBtn    = document.getElementById('captureBtn') as HTMLButtonElement;
//   const quizBtn       = document.getElementById('quizBtn')    as HTMLButtonElement;
//
//   if (!captureCanvas) {
//     console.error('❌ 找不到 <canvas id="capture">，请检查 HTML');
//     return;
//   }
//
//   const app = new VisionApp(videoEl, captureCanvas);
//   await app.start();
//   showMessage('Camera ready. Click capture to analyze.');
//
//   bindButton(captureBtn, async () => {
//     await app.analyze();
//     showMessage('Analysis complete. See console for details.');
//   });
//   bindButton(quizBtn, () => {
//     window.location.href = '/topics.html';
//   });
// });

// src/index.ts
import './styles.css';
import { auth, db } from '@modules/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { VisionApp } from '@modules/vision';
import { bindButton, showMessage } from '@modules/ui';

window.addEventListener('DOMContentLoaded', () => {
  // 1️⃣ 拿到所有需要的 DOM
  const authBtn     = document.getElementById('authBtn')     as HTMLButtonElement;
  const recordBtn   = document.getElementById('recordBtn')   as HTMLAnchorElement;
  const quizBtn     = document.getElementById('quizBtn')     as HTMLButtonElement;
  const avatarImg   = document.getElementById('userAvatar')  as HTMLImageElement;
  const welcomeText = document.getElementById('welcomeText') as HTMLElement;
  const captureBtn  = document.getElementById('captureBtn')  as HTMLButtonElement;
  const videoEl     = document.getElementById('video')      as HTMLVideoElement;
  const captureCanvas = document.getElementById('capture')    as HTMLCanvasElement | null;
  const overlayCanvas = document.getElementById('overlay') as HTMLCanvasElement;


  // 2️⃣ 监听登录状态
  // @ts-ignore
  onAuthStateChanged(auth, async (user: User | null) => {
    if (!user) {
      // 未登录直接跳回
      window.location.href = '/login.html';
      return;
    }

    // —— 确保用户文档存在并写入 role ——
    const userRef  = doc(db, 'users', user.uid);
    const snapUser = await getDoc(userRef);
    // 简单地以邮件决定老师身份，或你也可以从 snapUser.data().role 读
    const isTeacher = user.email === 'steve.kerrison@jcu.edu.au';
    await setDoc(userRef,
        { email: user.email, role: isTeacher ? 'teacher' : 'student' },
        { merge: true }
    );

    // —— 侧边栏头像 & 欢迎语 ——
    const seed = encodeURIComponent(user.email || '');
    avatarImg.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${seed}`;
    avatarImg.onerror = () => { avatarImg.src = '/assets/default-avatar.svg'; };
    const nameOnly = (user.email || '').split('@')[0];
    welcomeText.textContent = `Welcome, ${nameOnly}`;

    // —— 登出按钮 ——
    authBtn.textContent = 'Logout';
    authBtn.onclick = async () => {
      await signOut(auth);
      window.location.href = '/login.html';
    };

    // —— 学习记录按钮：学生 vs 教师 ——
    // 新：老师先到列表页，再从列表点人进入详情
    recordBtn.onclick = async e => {
      e.preventDefault();
      const fresh = await getDoc(userRef);
      const role  = fresh.exists() ? (fresh.data() as any).role : 'student';
      if (role === 'teacher') {
        window.location.href = '/teacher_list.html';
      } else {
        window.location.href = '/student_record.html';
      }
    };

    // —— Quiz / 编辑按钮 ——
    if (isTeacher) {
      quizBtn.textContent = 'Quiz Edit';
      bindButton(quizBtn, () => {
        window.location.href = '/quiz_editor.html';
      });
    } else {
      quizBtn.textContent = 'Start Quiz';
      bindButton(quizBtn, () => {
        window.location.href = '/topics.html';
      });
    }

    // —— AR 扫描功能 ——
    if (!captureCanvas) {
      console.error('❌ Cannot find <canvas id="capture">');
      return;
    }
    const app = new VisionApp(videoEl, captureCanvas, overlayCanvas);
    await app.start();
    showMessage('Camera ready. Click capture to analyze.');
    bindButton(captureBtn, async () => {
      await app.analyze();
      showMessage('Analysis complete. See console for details.');
    });
  });
});
