// js/firebase-config.js
// استبدل القيم التالية بقيم مشروع Firebase لديك
// يمكنك الحصول على هذه القيم من Firebase Console > Project Settings

// Example (fill with your actual config):
// const firebaseConfig = {
//   apiKey: "API_KEY",
//   authDomain: "PROJECT.firebaseapp.com",
//   databaseURL: "https://PROJECT.firebaseio.com",
//   projectId: "PROJECT_ID",
//   storageBucket: "PROJECT.appspot.com",
//   messagingSenderId: "SENDER_ID",
//   appId: "APP_ID"
// };

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
