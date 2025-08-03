import './styles.css';
import { auth, db } from '@modules/firebase';
import {
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    UserCredential
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

window.addEventListener('DOMContentLoaded', () => {
    /* ---------- DOM ---------- */
    const loginBtn      = document.getElementById('loginBtn')      as HTMLButtonElement;
    const googleBtn     = document.getElementById('googleBtn')     as HTMLButtonElement;
    const loginForm     = document.getElementById('loginForm')     as HTMLFormElement;
    const emailGroup    = document.getElementById('emailGroup')    as HTMLDivElement;
    const passwordGroup = document.getElementById('passwordGroup') as HTMLDivElement;
    const emailInput    = document.getElementById('emailInput')    as HTMLInputElement;
    const passwordInput = document.getElementById('passwordInput') as HTMLInputElement;
    const formBtn       = document.getElementById('formBtn')       as HTMLButtonElement;
    const showRegister  = document.getElementById('showRegister')  as HTMLAnchorElement;

    let step = 1;
    let savedEmail = '';

    /* ---------- Helpers ---------- */
    // @ts-ignore
    async function redirectAfterLogin(cred: UserCredential) {
        const snap = await getDoc(doc(db, 'users', cred.user.uid));
        /* 默认是学生。老师（role==='teacher' 或特定邮箱）先返回首页（/） */
        let role = 'student';
        if (snap.exists()) {
            role = (snap.data() as any).role;
        } else if (cred.user.email === 'steve.kerrison@jcu.edu.au') {
            role = 'teacher';
        }
        window.location.href = '/';            // 不分角色，全回 index.html
    }

    /* ---------- Top actions ---------- */
    loginBtn?.addEventListener('click', () => (window.location.href = '/login.html'));
    showRegister?.addEventListener('click', e => { e.preventDefault(); window.location.href = '/register.html'; });

    /* ---------- Google ---------- */
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    googleBtn?.addEventListener('click', async () => {
        try {
            const cred = await signInWithPopup(auth, provider);
            await redirectAfterLogin(cred);
        } catch (err: any) {
            alert('Google log fail!!：' + err.message);
        }
    });

    /* ---------- Email two-step ---------- */
    loginForm.addEventListener('submit', async e => {
        e.preventDefault();
        if (step === 1) {
            savedEmail = emailInput.value.trim();
            if (!savedEmail) return alert('Please enter a valid email.');
            emailGroup.classList.add('hidden');
            googleBtn.classList.add('hidden');
            document.querySelector('.divider')?.classList.add('hidden');
            passwordGroup.classList.remove('hidden');
            formBtn.textContent = 'Log in';
            passwordInput.focus();
            step = 2;
            return;
        }

        /* step 2: real login */
        const pwd = passwordInput.value;
        if (!pwd) return alert('Please enter your password.');
        try {
            const cred = await signInWithEmailAndPassword(auth, savedEmail, pwd);
            await redirectAfterLogin(cred);
        } catch (err: any) {
            alert('Login failed: ' + err.message);
        }
    });
});
