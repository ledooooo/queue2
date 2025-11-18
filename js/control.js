// Connect to Firebase
const db = firebase.database();
let ADMIN_LOGGED_IN = false;

// -------------------------------
// ADMIN LOGIN CHECK
// -------------------------------
async function checkAdminPassword() {
    const passInput = document.getElementById("adminPassword").value.trim();
    if (!passInput) {
        alert("⚠ أدخل كلمة المرور أولاً");
        return;
    }

    const snapshot = await db.ref("admin/passwordHash").once("value");
    const hash = snapshot.val();

    const encoder = new TextEncoder();
    const data = encoder.encode(passInput);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hexHash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

    if (hexHash === hash) {
        ADMIN_LOGGED_IN = true;
        document.getElementById("loginBox").style.display = "none";
        document.getElementById("controlPanel").style.display = "block";
        loadClinics();
    } else {
        alert("❌ كلمة المرور غير صحيحة");
    }
}

document.getElementById("loginBtn").addEventListener("click", checkAdminPassword);

// -------------------------------
// LOAD CLINICS INTO DROPDOWN
// -------------------------------
function loadClinics() {
    if (!ADMIN_LOGGED_IN) return;

    const dropdown = document.getElementById("clinicSelect");
    dropdown.innerHTML = `<option value="">اختر عيادة...</option>`;

    db.ref("clinics").once("value").then(snapshot => {
        snapshot.forEach(child => {
            const clinic = child.val();
            const opt = document.createElement("option");
            opt.value = clinic.id;
            opt.textContent = clinic.name;
            dropdown.appendChild(opt);
        });
    });
}

// -------------------------------
// CONTROL BUTTONS
// -------------------------------
document.getElementById("nextBtn").addEventListener("click", () => {
    const clinicId = document.getElementById("clinicSelect").value;
    if (!clinicId) return alert("اختر عيادة أولاً");

    db.ref(`clinics/${clinicId}/currentNumber`).transaction(n => (n || 0) + 1);
});

document.getElementById("prevBtn").addEventListener("click", () => {
    const clinicId = document.getElementById("clinicSelect").value;
    if (!clinicId) return alert("اختر عيادة أولاً");

    db.ref(`clinics/${clinicId}/currentNumber`).transaction(n => Math.max((n || 0) - 1, 0));
});

document.getElementById("resetBtn").addEventListener("click", () => {
    const clinicId = document.getElementById("clinicSelect").value;
    if (!clinicId) return alert("اختر عيادة أولاً");

    db.ref(`clinics/${clinicId}/currentNumber`).set(0);
});

document.getElementById("setNumberBtn").addEventListener("click", () => {
    const clinicId = document.getElementById("clinicSelect").value;
    const num = parseInt(document.getElementById("setNumber").value);

    if (!clinicId) return alert("اختر عيادة أولاً");
    if (isNaN(num)) return alert("أدخل رقم صحيح");

    db.ref(`clinics/${clinicId}/currentNumber`).set(num);
});
