// js/firebase-config.js
// ضع هنا إعدادات Firebase الحقيقية لمشروعك (احصل عليها من Firebase Console → Project settings → SDK setup)
if (!window.firebase) {
  console.error("Firebase SDK غير محمّل — تأكد من إضافة سكربت Firebase في HTML.");
} else {
  // --- ضع هنا كائن التكوين:
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAFWC6YJzFi9B-XQbWQejEQOwuiL2G3PC4",
  authDomain: "queue2-5c4eb.firebaseapp.com",
  databaseURL: "https://queue2-5c4eb-default-rtdb.firebaseio.com",
  projectId: "queue2-5c4eb",
  storageBucket: "queue2-5c4eb.firebasestorage.app",
  messagingSenderId: "15303249058",
  appId: "1:15303249058:web:5aa93bf30cf62d6f015bfb",
  measurementId: "G-ZQF0DJH06Q"
};

  try {
    firebase.initializeApp(firebaseConfig);
    window.auth = firebase.auth();
    window.db = firebase.database();
    window.storage = firebase.storage();
    console.log("Firebase initialized.");
  } catch (e) {
    console.error("خطأ تهيئة Firebase:", e);
  }
}
