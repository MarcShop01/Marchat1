import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
import { 
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js";
import { 
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js";

// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBLUZl0j_gO7aZtT2zwgTISWO5ab9AFfE0",
  authDomain: "marchat-b23f1.firebaseapp.com",
  projectId: "marchat-b23f1",
  storageBucket: "marchat-b23f1.appspot.com",
  messagingSenderId: "264746644024",
  appId: "1:264746644024:web:d575bac7eb65c3d3062ccd",
  measurementId: "G-Y9Q0XWH80H"
};

// Initialisation Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Données des pays
const countries = [
  { name: "Côte d'Ivoire", code: "+225" },
  { name: "France", code: "+33" },
  { name: "États-Unis", code: "+1" },
  { name: "Sénégal", code: "+221" },
  { name: "Cameroun", code: "+237" }
];

// Éléments DOM
const authScreen = document.getElementById('auth-screen');
const otpScreen = document.getElementById('otp-screen');
const chatScreen = document.getElementById('chat-screen');
const countrySearch = document.getElementById('country-search');
const countryCodeSelect = document.getElementById('country-code');
const countryCodeInput = document.getElementById('country-code-input');
const phoneInput = document.getElementById('phone');
const sendOtpBtn = document.getElementById('send-otp');
const userPhoneDisplay = document.getElementById('user-phone-display');
const otpDigits = document.querySelectorAll('.otp-digit');
const verifyOtpBtn = document.getElementById('verify-otp');
const resendOtpBtn = document.getElementById('resend-otp');
const chatContainer = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const sendMessageBtn = document.getElementById('send-message');
const logoutBtn = document.getElementById('logout-btn');

let confirmationResult = null;
let currentUser = null;
let recaptchaVerifier = null;

// Initialisation
function init() {
  populateCountryList();
  setupEventListeners();
  setupRecaptcha();
  checkAuthState();
}

function setupRecaptcha() {
  recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
    size: 'invisible',
    callback: (response) => {
      console.log("reCAPTCHA résolu", response);
    },
    'expired-callback': () => {
      showError("reCAPTCHA expiré, veuillez réessayer");
    }
  });
}

function populateCountryList() {
  countries.sort((a, b) => a.name.localeCompare(b.name));
  
  countries.forEach(country => {
    const option = document.createElement('option');
    option.value = country.code;
    option.textContent = `${country.name} (${country.code})`;
    countryCodeSelect.appendChild(option);
  });
}

function setupEventListeners() {
  // Recherche de pays
  countrySearch.addEventListener('focus', () => {
    countryCodeSelect.style.display = 'block';
  });
  
  countrySearch.addEventListener('input', filterCountries);
  
  // Sélection de pays
  countryCodeSelect.addEventListener('click', (e) => {
    if (e.target.tagName === 'OPTION') {
      countryCodeInput.value = e.target.value;
      countryCodeSelect.style.display = 'none';
      countrySearch.value = '';
    }
  });
  
  // Envoi OTP
  sendOtpBtn.addEventListener('click', sendOtp);
  
  // Gestion OTP
  otpDigits.forEach(digit => {
    digit.addEventListener('input', handleOtpInput);
    digit.addEventListener('keydown', handleOtpBackspace);
  });
  
  verifyOtpBtn.addEventListener('click', verifyOtp);
  resendOtpBtn.addEventListener('click', resendOtp);
  
  // Chat
  sendMessageBtn.addEventListener('click', sendMessage);
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  
  logoutBtn.addEventListener('click', () => {
    signOut(auth);
  });
}

function filterCountries() {
  const searchTerm = countrySearch.value.toLowerCase();
  const options = countryCodeSelect.options;
  
  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    const text = option.text.toLowerCase();
    option.style.display = text.includes(searchTerm) ? 'block' : 'none';
  }
}

async function sendOtp() {
  const countryCode = countryCodeInput.value;
  const phoneNumber = phoneInput.value.trim();
  const fullNumber = countryCode + phoneNumber;

  // Validation
  if (!phoneNumber || !/^\d{8,15}$/.test(phoneNumber)) {
    showError("Numéro invalide. Entre 8 et 15 chiffres sans espaces");
    return;
  }

  try {
    // UI Loading
    toggleLoading(true, sendOtpBtn);
    
    // Envoi du SMS
    confirmationResult = await signInWithPhoneNumber(auth, fullNumber, recaptchaVerifier);
    
    // Succès
    userPhoneDisplay.textContent = fullNumber;
    authScreen.classList.add('hidden');
    otpScreen.classList.remove('hidden');
    otpDigits[0].focus();

  } catch (error) {
    console.error("Erreur:", error);
    handleAuthError(error);
  } finally {
    // Reset UI
    toggleLoading(false, sendOtpBtn);
  }
}

function handleAuthError(error) {
  const errorMap = {
    'auth/invalid-phone-number': 'Numéro de téléphone invalide. Format: +2250102030405',
    'auth/missing-phone-number': 'Veuillez entrer un numéro',
    'auth/quota-exceeded': 'Limite de SMS atteinte. Réessayez plus tard',
    'auth/too-many-requests': 'Trop de tentatives. Patientez avant de réessayer',
    'auth/captcha-check-failed': 'Vérification reCAPTCHA échouée. Rafraîchissez la page',
    'default': 'Erreur technique. Veuillez réessayer'
  };

  showError(errorMap[error.code] || errorMap.default);
}

function showError(message) {
  const errorElement = document.getElementById('error-message');
  errorElement.textContent = message;
  setTimeout(() => errorElement.textContent = '', 5000);
}

function toggleLoading(isLoading, button) {
  button.disabled = isLoading;
  const spinner = button.querySelector('i');
  const text = button.querySelector('span');
  
  if (isLoading) {
    spinner.classList.remove('hidden');
    text.classList.add('hidden');
  } else {
    spinner.classList.add('hidden');
    text.classList.remove('hidden');
  }
}

function handleOtpInput(e) {
  const digit = e.target;
  const index = parseInt(digit.dataset.index);
  
  if (digit.value.length === 1 && index < otpDigits.length - 1) {
    otpDigits[index + 1].focus();
  }
}

function handleOtpBackspace(e) {
  const digit = e.target;
  const index = parseInt(digit.dataset.index);
  
  if (e.key === 'Backspace' && digit.value === '' && index > 0) {
    otpDigits[index - 1].focus();
  }
}

async function verifyOtp() {
  const otpCode = Array.from(otpDigits).map(d => d.value).join('');
  
  if (otpCode.length !== 6) {
    showError("Veuillez entrer un code complet à 6 chiffres");
    return;
  }
  
  try {
    // UI Loading
    toggleLoading(true, verifyOtpBtn);
    
    await confirmationResult.confirm(otpCode);
    
  } catch (error) {
    console.error("Erreur:", error);
    showError("Code incorrect. Veuillez réessayer.");
  } finally {
    // Reset UI
    toggleLoading(false, verifyOtpBtn);
  }
}

async function resendOtp(e) {
  e.preventDefault();
  await sendOtp();
  showError("Un nouveau code a été envoyé");
}

function checkAuthState() {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUser = user;
      authScreen.classList.add('hidden');
      otpScreen.classList.add('hidden');
      chatScreen.classList.remove('hidden');
      initChat(user);
    } else {
      authScreen.classList.remove('hidden');
      otpScreen.classList.add('hidden');
      chatScreen.classList.add('hidden');
    }
  });
}

function initChat(user) {
  // Afficher le numéro dans l'avatar
  const phoneLastDigits = user.phoneNumber.slice(-2);
  document.getElementById('user-avatar').textContent = phoneLastDigits;
  
  // Écouter les messages
  const messagesQuery = query(
    collection(db, "messages"),
    orderBy("timestamp")
  );
  
  onSnapshot(messagesQuery, (snapshot) => {
    chatContainer.innerHTML = '';
    snapshot.forEach((doc) => {
      displayMessage(doc.data());
    });
    scrollToBottom();
  });
}

async function sendMessage() {
  const text = messageInput.value.trim();
  
  if (!text || !currentUser) return;
  
  const message = {
    text: text,
    senderId: currentUser.uid,
    timestamp: serverTimestamp()
  };
  
  try {
    await addDoc(collection(db, "messages"), message);
    messageInput.value = '';
  } catch (error) {
    console.error("Erreur:", error);
    showError("Erreur lors de l'envoi du message");
  }
}

function displayMessage(message) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${message.senderId === currentUser.uid ? 'sent' : 'received'}`;
  
  messageDiv.innerHTML = `
    <div class="message-text">${message.text}</div>
    <div class="message-time">${formatTime(message.timestamp?.toDate())}</div>
  `;
  
  chatContainer.appendChild(messageDiv);
  scrollToBottom();
}

function formatTime(date) {
  if (!date) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Démarrer l'application
document.addEventListener('DOMContentLoaded', init);