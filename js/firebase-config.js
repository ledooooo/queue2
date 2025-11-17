// js/firebase-config.js
// استبدل القيم التالية بقيم مشروع Firebase لديك
// يمكنك الحصول على هذه القيم من Firebase Console > Project Settings

 const firebaseConfig = {
    apiKey: "AIzaSyAFWC6YJzFi9B-XQbWQejEQOwuiL2G3PC4",
    authDomain: "queue2-5c4eb.firebaseapp.com",
    projectId: "queue2-5c4eb",
    storageBucket: "queue2-5c4eb.firebasestorage.app",
    messagingSenderId: "15303249058",
    appId: "1:15303249058:web:5aa93bf30cf62d6f015bfb",
    measurementId: "G-ZQF0DJH06Q"
  };

if (!window.firebase) {
  console.error("Firebase SDK غير محمّل. تأكد من إضافة سكربت Firebase في HTML.");
} else {
  // Paste your config object below:
  const firebaseConfig = {
    // <-- ضع هنا بياناتك
  };

  try {
    firebase.initializeApp(firebaseConfig);
    window.db = firebase.database();
    window.storage = firebase.storage();
    console.log("Firebase initialized.");
  } catch (e) {
    console.error("Firebase init error:", e);
  }
}
