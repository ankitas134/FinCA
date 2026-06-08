// FinCA — Firebase initialization, auth, and Firestore
// Replace firebaseConfig values with your own project credentials

import{initializeApp}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import{getAuth,signInWithPopup,signInWithEmailAndPassword,createUserWithEmailAndPassword,GoogleAuthProvider,signOut,onAuthStateChanged}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import{getFirestore,collection,addDoc,getDocs,query,where,orderBy,limit,doc,setDoc}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
// ─── Firebase Configuration ───────────────────────────────────────────
// Replace these placeholder values with your own Firebase project credentials.
// Get them from: https://console.firebase.google.com → Project Settings → Your apps
// FinCA works fully without Firebase — users just cannot save reports across sessions.
// NEVER commit real API keys to a public repository.
const firebaseConfig={
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};
const app=initializeApp(firebaseConfig);
const auth=getAuth(app);const db=getFirestore(app);const provider=new GoogleAuthProvider();
window._auth=auth;window._db=db;window._provider=provider;
window._signInWithPopup=signInWithPopup;window._signInWithEmailAndPassword=signInWithEmailAndPassword;
window._createUserWithEmailAndPassword=createUserWithEmailAndPassword;window._signOut=signOut;
window._addDoc=addDoc;window._getDocs=getDocs;window._query=query;window._where=where;
window._orderBy=orderBy;window._limit=limit;window._collection=collection;window._doc=doc;window._setDoc=setDoc;
onAuthStateChanged(auth,user=>{window._currentUser=user;updateNavAuth(user);if(user&&document.getElementById('page-auth')?.classList.contains('active'))goTo('landing');});