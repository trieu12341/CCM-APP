// Initialize Firebase
const firebaseConfig = {
    projectId: "cost-contract-management"
};

// Khởi tạo Firebase App nếu chưa có
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Export biến db (Firestore)
export const db = firebase.firestore();
