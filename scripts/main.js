/**
 * Tutorly - Main JavaScript File
 * Handles navigation, UI interactions, and dynamic updates
 */

(function initTutorlyApiBaseFromMeta() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (window.TUTORLY_API_BASE) return;
    const el = document.querySelector('meta[name="tutorly-api-base"]');
    const v = el?.getAttribute('content')?.trim();
    if (v) window.TUTORLY_API_BASE = v;
})();

// ===== NAVIGATION SYSTEM =====
// Screen order for navigation buttons
const SCREEN_ORDER = ['onboarding', 'search', 'profile', 'booking', 'dashboard', 'admin'];

const SCREEN_TO_PAGE = {
    onboarding: '/pages/onboarding.html?mode=login',
    search: '/pages/search.html',
    profile: '/pages/profile.html',
    booking: '/pages/booking.html',
    dashboard: '/pages/dashboard.html',
    admin: '/pages/admin.html',
};

const API_BASE_URL = (() => {
    if (typeof window === 'undefined') return '';
    const explicitBase = window.TUTORLY_API_BASE;
    if (explicitBase) return String(explicitBase).replace(/\/+$/, '');

    const host = window.location.hostname.toLowerCase();
    const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';

    // Local dev: API on 7503. Production: same origin (reverse-proxy /auth, /tutors, … on 443).
    // Split hosting: set window.TUTORLY_API_BASE (e.g. '/api' or full URL) before this script.
    return isLocalhost
        ? `${window.location.protocol}//${window.location.hostname}:7503`
        : '';
})();

const STUDENT_LEVEL_LABELS = {
    'high-school': 'High School',
    'university': 'University',
    'graduate': 'Graduate',
    'professional': 'Professional Development',
};

function formatSubjectSlugLabel(slug) {
    if (!slug || typeof slug !== 'string') return '';
    return slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ');
}

function shortBookingRef(id) {
    if (!id || typeof id !== 'string') return '';
    return id.length >= 8 ? id.slice(0, 8) : id;
}

function bookingDetailPageHref(bookingId) {
    return `/pages/dashboard.html?booking=${encodeURIComponent(bookingId)}`;
}

/** When opening the dashboard with `?booking=<uuid>`, focus the matching session row. */
function highlightDashboardBookingRow(container, bookingId) {
    if (!container || !bookingId) return;
    const row = container.querySelector(`[data-booking-id="${bookingId}"]`);
    if (!row) return;
    row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    row.classList.add('booking-session-highlight');
    window.setTimeout(() => row.classList.remove('booking-session-highlight'), 2800);
    try {
        const url = new URL(window.location.href);
        url.searchParams.delete('booking');
        const q = url.searchParams.toString();
        window.history.replaceState({}, '', url.pathname + (q ? `?${q}` : ''));
    } catch {
        /* ignore */
    }
}

const AUTH_TOKEN_KEY = 'tutorly_token';
const AUTH_USER_KEY = 'tutorly_user';

function readStoredAuthRaw() {
    let token = localStorage.getItem(AUTH_TOKEN_KEY);
    let userRaw = localStorage.getItem(AUTH_USER_KEY);
    if (!token || !userRaw) {
        token = token || sessionStorage.getItem(AUTH_TOKEN_KEY);
        userRaw = userRaw || sessionStorage.getItem(AUTH_USER_KEY);
    }
    return { token, userRaw };
}

function getAuth() {
    const { token, userRaw } = readStoredAuthRaw();
    let user = null;
    if (userRaw) {
        try {
            user = JSON.parse(userRaw);
        } catch {
            user = null;
        }
    }
    return { token, user };
}

function setAuth({ token, user }) {
    const userJson = JSON.stringify(user);
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, userJson);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_USER_KEY);
}

function clearAuth() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_USER_KEY);
}

function landingScreenForUser(user) {
    if (!user?.role) return 'search';
    if (user.role === 'admin') return 'admin';
    if (user.role === 'tutor') return 'dashboard';
    return 'search';
}

function getFlowState() {
    const selectedTutorRaw = sessionStorage.getItem('tutorly_selected_tutor');
    return {
        selectedTutor: selectedTutorRaw ? JSON.parse(selectedTutorRaw) : null,
    };
}

function setSelectedTutor(tutor) {
    sessionStorage.setItem('tutorly_selected_tutor', JSON.stringify(tutor));
}

function getCurrentScreenIdFromPath() {
    const path = window.location.pathname.replace(/\\/g, '/');
    const match = path.match(/\/pages\/([a-z-]+)\.html$/i);
    if (match) {
        const page = match[1].toLowerCase();
        if (page === 'onboarding') return 'onboarding';
        if (page === 'search') return 'search';
        if (page === 'profile') return 'profile';
        if (page === 'booking') return 'booking';
        if (page === 'dashboard') return 'dashboard';
        if (page === 'admin') return 'admin';
    }
    if (path === '/' || path === '/index.html' || path.endsWith('index.html')) return 'index';
    return null;
}

function navigateTo(screenId) {
    if (!SCREEN_TO_PAGE[screenId]) return;
    sessionStorage.setItem('tutorly_last_screen', screenId);
    window.location.assign(SCREEN_TO_PAGE[screenId]);
}

function isAllowed(screenId) {
    const { token, user } = getAuth();
    const { selectedTutor } = getFlowState();

    // Onboarding only when signed out.
    if (screenId === 'onboarding') return !token || !user;

    if (screenId === 'index') return true;

    // Must be authenticated for everything else.
    if (!token || !user) return false;

    if (screenId === 'dashboard') return user.role !== 'admin'; // Admins use admin, not dashboard
    if (screenId === 'admin') return user.role === 'admin';

    // Admin: portal + browsing tutors only (student booking flow uses separate routes).
    if (user.role === 'admin') {
        return screenId === 'search';
    }

    // Student journey.
    if (user.role === 'student') {
        if (screenId === 'search') return true;
        if (screenId === 'profile') return !!selectedTutor;
        if (screenId === 'booking') return !!selectedTutor;
        return false;
    }

    // Tutor journey (minimal for now): dashboard only.
    if (user.role === 'tutor') {
        return screenId === 'dashboard';
    }

    return false;
}

function enforceRouteGuard(currentScreen) {
    if (!currentScreen) return;

    const { token, user } = getAuth();

    // Signed-in users: redirect index and onboarding to their main page
    if (token && user && (currentScreen === 'index' || currentScreen === 'onboarding')) {
        const mainPage = landingScreenForUser(user);
        sessionStorage.setItem('tutorly_last_screen', mainPage);
        window.location.replace(SCREEN_TO_PAGE[mainPage]);
        return;
    }

    if (isAllowed(currentScreen)) return;

    // Admins trying to access dashboard -> redirect to admin
    if (currentScreen === 'dashboard' && token && user?.role === 'admin') {
        sessionStorage.setItem('tutorly_last_screen', 'admin');
        window.location.replace(SCREEN_TO_PAGE.admin);
        return;
    }

    if (currentScreen === 'admin') {
        sessionStorage.setItem('tutorly_last_screen', 'onboarding');
        window.location.replace(SCREEN_TO_PAGE.onboarding);
        return;
    }

    // Signed-in admin hit a route they cannot use → Admin portal (avoid bouncing them to login).
    if (token && user?.role === 'admin') {
        sessionStorage.setItem('tutorly_last_screen', 'admin');
        window.location.replace(SCREEN_TO_PAGE.admin);
        return;
    }

    sessionStorage.setItem('tutorly_last_screen', 'onboarding');
    window.location.replace(SCREEN_TO_PAGE.onboarding);
}

function updateNavLocking() {
    const { token, user } = getAuth();
    const { selectedTutor } = getFlowState();

    document.querySelectorAll('.nav-btn[data-screen]').forEach(btn => {
        const screenId = btn.getAttribute('data-screen');
        if (!screenId) return;

        const allowed = isAllowed(screenId);
        btn.disabled = !allowed;

        // Optional: explain why disabled via title
        if (!allowed) {
            if (!token || !user) btn.title = 'Sign in to continue';
            else if (screenId === 'onboarding') btn.title = 'Sign out to access';
            else if (screenId === 'dashboard' && user?.role === 'admin') btn.title = 'Use Admin portal instead';
            else if (user?.role === 'admin' && (screenId === 'profile' || screenId === 'booking')) btn.title = 'Not available in admin portal';
            else if ((screenId === 'profile' || screenId === 'booking') && !selectedTutor) btn.title = 'Select a tutor first';
            else if (user?.role === 'tutor') btn.title = 'Available after setup';
        } else {
            btn.title = '';
        }
    });
}

async function apiRequest(path, { method = 'GET', body = undefined, auth = true } = {}) {
    const { token } = getAuth();
    const headers = { 'Content-Type': 'application/json' };
    if (auth && token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
        if (res.status === 401 && auth) {
            clearAuth();
            const screen = getCurrentScreenIdFromPath();
            if (screen && screen !== 'onboarding' && screen !== 'index') {
                window.location.replace(SCREEN_TO_PAGE.onboarding);
            }
        }
        const message = data?.message || data?.error || 'Request failed';
        const err = new Error(message);
        err.status = res.status;
        err.payload = data;
        throw err;
    }
    return data;
}

/**
 * Shows a specific screen by ID and updates active states
 * @param {string} screenId - The ID of the screen to show
 */
function showScreen(screenId) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show selected screen
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
    
    // Update active nav button
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Find and activate the corresponding nav button
    const screenIndex = SCREEN_ORDER.indexOf(screenId);
    const navButtons = document.querySelectorAll('.nav-btn');
    
    if (screenIndex >= 0 && navButtons[screenIndex]) {
        navButtons[screenIndex].classList.add('active');
    }
    
    // Store current screen in session storage (optional)
    sessionStorage.setItem('tutorly_last_screen', screenId);
}

/**
 * Handles time slot selection in booking screen
 * @param {HTMLElement} element - The clicked time slot element
 */
function selectTimeSlot(element) {
    if (element.classList.contains('unavailable')) return false;

    // Remove selected class from all time slots
    document.querySelectorAll('.time-slot').forEach(slot => {
        slot.classList.remove('selected');
    });
    
    // Add selected class to clicked time slot
    element.classList.add('selected');
    
    // Update booking summary time
    const timeText = element.textContent.trim();
    const summaryElement = document.getElementById('summary-time');
    if (summaryElement) {
        summaryElement.textContent = `Tomorrow, ${timeText}`;
    }

    return true;
}

/**
 * Initializes all event listeners
 */
function initializeEventListeners() {
    // Navigation buttons click handlers
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const screenId = btn.getAttribute('data-screen');
            if (screenId) {
                // Multi-page navigation
                if (SCREEN_TO_PAGE[screenId]) {
                    e.preventDefault();
                    if (isAllowed(screenId)) {
                        navigateTo(screenId);
                    }
                    return;
                }
                showScreen(screenId);
            }
        });
    });
    
    // Data-navigate attributes (for buttons that navigate to another screen)
    document.querySelectorAll('[data-navigate]').forEach(element => {
        element.addEventListener('click', (e) => {
            const targetScreen = element.getAttribute('data-navigate');
            if (targetScreen) {
                if (SCREEN_TO_PAGE[targetScreen]) {
                    e.preventDefault();
                    if (isAllowed(targetScreen)) {
                        navigateTo(targetScreen);
                    }
                    return;
                }
                showScreen(targetScreen);
            }
        });
    });
    
    // Time slot selection
    document.querySelectorAll('.time-slot').forEach(slot => {
        slot.addEventListener('click', (e) => {
            const selected = selectTimeSlot(slot);
            const bookingErrorEl = document.getElementById('booking-error');
            if (!selected && bookingErrorEl) {
                bookingErrorEl.textContent = 'That slot is no longer available. Please choose another time.';
                bookingErrorEl.classList.add('visible');
            } else if (bookingErrorEl) {
                bookingErrorEl.textContent = '';
                bookingErrorEl.classList.remove('visible');
            }
        });
    });
    
    // Tutor cards - use delegation for dynamically added cards
    document.getElementById('tutor-grid')?.addEventListener('click', (e) => {
        const card = e.target.closest('.tutor-card');
        if (!card) return;
        const tutorId = card.dataset.tutorId;
        const tutors = window.__tutorlyTutors;
        if (tutorId && tutors) {
            const t = tutors.find(x => x.id === tutorId);
            if (t) setSelectedTutor(t);
        }
        if (isAllowed('profile')) navigateTo('profile');
    });
    
    // Form submissions (prevent actual submit)
    document.querySelectorAll('form, .btn-primary[type="submit"]').forEach(form => {
        if (form.tagName === 'FORM') {
            form.addEventListener('submit', (e) => e.preventDefault());
        }
    });
    
    // Session length buttons (visual feedback only)
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.textContent.includes('min')) {
            btn.addEventListener('click', function() {
                // Remove active class from all session length buttons
                document.querySelectorAll('.nav-btn').forEach(b => {
                    if (b.textContent.includes('min')) {
                        b.style.background = 'rgba(255,255,255,0.2)';
                        b.style.color = 'white';
                    }
                });
                // Style clicked button
                this.style.background = '#4f46e5';
                this.style.color = 'white';
            });
        }
    });
}

/**
 * Restores the last viewed screen from session storage
 */
function restoreLastScreen() {
    const lastScreen = sessionStorage.getItem('tutorly_last_screen');
    if (lastScreen && SCREEN_ORDER.includes(lastScreen)) {
        showScreen(lastScreen);
    } else {
        showScreen('onboarding'); // Default to onboarding
    }
}

/**
 * Updates booking summary with selected options
 */
function updateBookingSummary() {
    // Get selected time slot
    const selectedSlot = document.querySelector('.time-slot.selected');
    if (selectedSlot) {
        const timeText = selectedSlot.textContent.trim();
        const summaryElement = document.getElementById('summary-time');
        if (summaryElement) {
            summaryElement.textContent = `Tomorrow, ${timeText}`;
        }
    }
    
    // Get selected duration (simplified - would be more complex in real app)
    const activeDuration = document.querySelector('.nav-btn[style*="background: #4f46e5"]');
    if (activeDuration && activeDuration.textContent.includes('min')) {
        // Update duration in summary if needed
        console.log('Duration selected:', activeDuration.textContent);
    }
}

/**
 * Handles responsive adjustments
 */
function handleResponsive() {
    const checkMobile = () => {
        const isMobile = window.innerWidth <= 768;
        document.body.classList.toggle('is-mobile', isMobile);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
}

/**
 * Adds smooth scrolling for anchor links (if any)
 */
function setupSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

/**
 * Initialize tooltips and additional UI enhancements
 */
function setupUIEnhancements() {
    // Add hover effect for verification badges
    document.querySelectorAll('.verification-badge').forEach(badge => {
        badge.addEventListener('mouseenter', () => {
            badge.style.transform = 'scale(1.05)';
        });
        badge.addEventListener('mouseleave', () => {
            badge.style.transform = 'scale(1)';
        });
    });
    
    // Add focus styles for form inputs
    document.querySelectorAll('.form-input').forEach(input => {
        input.addEventListener('focus', () => {
            input.parentElement.classList.add('focused');
        });
        input.addEventListener('blur', () => {
            input.parentElement.classList.remove('focused');
        });
    });
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('Tutorly initialized');
    
    // Initialize all event listeners
    initializeEventListeners();
    
    // If we're on a multi-page route, enforce realistic access rules first.
    const currentFromPath = getCurrentScreenIdFromPath();
    if (currentFromPath) {
        enforceRouteGuard(currentFromPath);
    }

    // Update locked/unlocked nav state.
    updateNavLocking();

    // Sign out button
    const signoutBtn = document.getElementById('nav-signout');
    if (signoutBtn) {
        const { token } = getAuth();
        signoutBtn.style.display = token ? 'inline-flex' : 'none';
        signoutBtn.addEventListener('click', () => {
            clearAuth();
            sessionStorage.removeItem('tutorly_selected_tutor');
            window.location.replace(SCREEN_TO_PAGE.onboarding);
        });
    }

    // If we're on a multi-page route, highlight the active nav button.
    if (currentFromPath) {
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll(`.nav-btn[data-screen="${currentFromPath}"]`).forEach(btn => btn.classList.add('active'));
    } else {
        // Backwards-compatible: if still using single-page layout, restore last screen.
        restoreLastScreen();
    }
    
    // Update booking summary
    updateBookingSummary();
    
    // Handle responsive design
    handleResponsive();
    
    // Setup smooth scrolling
    setupSmoothScrolling();
    
    // Add UI enhancements
    setupUIEnhancements();

    // Onboarding auth wiring (only on onboarding page)
    if (currentFromPath === 'onboarding') {
        const modeRegisterBtn = document.getElementById('auth-mode-register');
        const modeLoginBtn = document.getElementById('auth-mode-login');
        const registerFields = document.getElementById('auth-register-fields');
        const signupSubjectsWrap = document.getElementById('signup-subjects-wrap');
        const signupSubjectsLegend = document.getElementById('signup-subjects-legend');
        const studentLevelGroup = document.getElementById('student-level-group');
        const fullNameEl = document.getElementById('auth-full-name');
        const emailEl = document.getElementById('auth-email');
        const passwordEl = document.getElementById('auth-password');
        const roleEl = document.getElementById('auth-role');
        const studentLevelEl = document.getElementById('student-level');
        const submitEl = document.getElementById('auth-submit');
        const errorEl = document.getElementById('auth-error');
        const switchText = document.getElementById('auth-switch-text');
        const fieldErrorMap = {
            fullName: document.getElementById('auth-full-name-error'),
            email: document.getElementById('auth-email-error'),
            password: document.getElementById('auth-password-error'),
            signupSubjects: document.getElementById('signup-subjects-error'),
            studentLevel: document.getElementById('student-level-error'),
        };
        let isSubmittingAuth = false;

        const urlMode = new URLSearchParams(window.location.search).get('mode');
        let mode = (urlMode === 'login' || urlMode === 'register') ? urlMode : 'login';

        function regSubjectCheckedCount() {
            return document.querySelectorAll('input[name="reg-subject"]:checked').length;
        }

        function applyMode() {
            document.querySelectorAll('.auth-tab').forEach(t => {
                t.setAttribute('aria-pressed', t === (mode === 'register' ? modeRegisterBtn : modeLoginBtn) ? 'true' : 'false');
                t.classList.toggle('active', t === (mode === 'register' ? modeRegisterBtn : modeLoginBtn));
            });
            if (registerFields) registerFields.style.display = mode === 'register' ? '' : 'none';
            if (submitEl && !isSubmittingAuth) submitEl.textContent = mode === 'register' ? 'Create Account' : 'Sign In';
            if (switchText) {
                if (mode === 'register') {
                    switchText.innerHTML = 'Already have an account? <button type="button" class="auth-link">Sign in</button>';
                } else {
                    switchText.innerHTML = 'Don\'t have an account? <button type="button" class="auth-link">Create one</button>';
                }
            }
            if (roleEl) updateSignupFieldsVisibility();
            clearAllFieldErrors();
        }

        function updateSignupFieldsVisibility() {
            const r = roleEl?.value;
            const isStudent = r === 'student';
            const isTutor = r === 'tutor';
            const showSubjects = mode === 'register' && (isStudent || isTutor);
            if (signupSubjectsWrap) signupSubjectsWrap.style.display = showSubjects ? '' : 'none';
            if (studentLevelGroup) studentLevelGroup.style.display = mode === 'register' && isStudent ? '' : 'none';
            if (signupSubjectsLegend) {
                signupSubjectsLegend.innerHTML = isTutor
                    ? 'Subjects you teach <span class="form-label-hint">(select one or more)</span>'
                    : 'Subjects <span class="form-label-hint">(select one or more)</span>';
            }
        }

        function setFieldError(fieldName, message) {
            const fieldMap = {
                fullName: fullNameEl,
                email: emailEl,
                password: passwordEl,
                signupSubjects: signupSubjectsWrap,
                studentLevel: studentLevelEl,
            };
            const field = fieldMap[fieldName];
            const errorNode = fieldErrorMap[fieldName];
            if (!errorNode) return;
            errorNode.textContent = message || '';
            if (field) field.classList.toggle('is-invalid', !!message);
        }

        function clearAllFieldErrors() {
            Object.keys(fieldErrorMap).forEach(key => setFieldError(key, ''));
        }

        function validateField(fieldName) {
            const email = emailEl?.value.trim() || '';
            const password = passwordEl?.value || '';
            const fullName = fullNameEl?.value.trim() || '';
            const studentLevel = studentLevelEl?.value || '';
            const isRegister = mode === 'register';
            const role = roleEl?.value;
            const isStudent = role === 'student';
            const needsSubjects = isRegister && (role === 'student' || role === 'tutor');

            if (fieldName === 'email') {
                if (!email) return 'Email is required';
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address';
                return '';
            }
            if (fieldName === 'password') {
                if (!password) return 'Password is required';
                if (isRegister && password.length < 8) return 'Password must be at least 8 characters';
                return '';
            }
            if (fieldName === 'fullName') {
                if (isRegister && !fullName) return 'Full name is required';
                return '';
            }
            if (fieldName === 'signupSubjects') {
                if (needsSubjects && regSubjectCheckedCount() < 1) return 'Select at least one subject';
                return '';
            }
            if (fieldName === 'studentLevel') {
                if (isRegister && isStudent && !studentLevel) return 'Select an education level';
                return '';
            }
            return '';
        }

        function validateAuthForm() {
            const fields = ['email', 'password'];
            if (mode === 'register') {
                fields.push('fullName');
                const r = roleEl?.value;
                if (r === 'student') {
                    fields.push('signupSubjects', 'studentLevel');
                } else if (r === 'tutor') {
                    fields.push('signupSubjects');
                }
            }

            let isValid = true;
            fields.forEach((name) => {
                const message = validateField(name);
                setFieldError(name, message);
                if (message) isValid = false;
            });
            return isValid;
        }

        function setSubmittingState(isSubmitting) {
            isSubmittingAuth = isSubmitting;
            if (!submitEl) return;
            submitEl.disabled = isSubmitting;
            submitEl.classList.toggle('is-loading', isSubmitting);
            submitEl.textContent = isSubmitting
                ? (mode === 'register' ? 'Creating Account' : 'Signing In')
                : (mode === 'register' ? 'Create Account' : 'Sign In');
        }

        modeRegisterBtn?.addEventListener('click', () => { mode = 'register'; applyMode(); });
        modeLoginBtn?.addEventListener('click', () => { mode = 'login'; applyMode(); });
        roleEl?.addEventListener('change', () => {
            updateSignupFieldsVisibility();
            setFieldError('signupSubjects', validateField('signupSubjects'));
            setFieldError('studentLevel', validateField('studentLevel'));
        });
        emailEl?.addEventListener('input', () => setFieldError('email', validateField('email')));
        emailEl?.addEventListener('blur', () => setFieldError('email', validateField('email')));
        passwordEl?.addEventListener('input', () => setFieldError('password', validateField('password')));
        passwordEl?.addEventListener('blur', () => setFieldError('password', validateField('password')));
        fullNameEl?.addEventListener('input', () => setFieldError('fullName', validateField('fullName')));
        fullNameEl?.addEventListener('blur', () => setFieldError('fullName', validateField('fullName')));
        studentLevelEl?.addEventListener('change', () => setFieldError('studentLevel', validateField('studentLevel')));
        signupSubjectsWrap?.addEventListener('change', (e) => {
            if (e.target.matches?.('input[name="reg-subject"]')) {
                setFieldError('signupSubjects', validateField('signupSubjects'));
            }
        });
        switchText?.addEventListener('click', (e) => {
            if (e.target.closest?.('.auth-link') || e.target.classList?.contains('auth-link')) {
                e.preventDefault();
                mode = mode === 'register' ? 'login' : 'register';
                applyMode();
            }
        });
        applyMode();

        submitEl?.addEventListener('click', async () => {
            if (!emailEl || !passwordEl || !submitEl) return;
            if (errorEl) { errorEl.textContent = ''; errorEl.classList.remove('visible'); }
            if (!validateAuthForm()) return;

            const email = emailEl.value.trim();
            const password = passwordEl.value;
            const fullName = fullNameEl?.value?.trim();
            const role = roleEl?.value ?? 'student';
            const pickedSubjects = Array.from(document.querySelectorAll('input[name="reg-subject"]:checked')).map(cb => cb.value);

            try {
                setSubmittingState(true);
                let payload;
                if (mode === 'register') {
                    payload = { fullName, email, password, role };
                    if (role === 'student') {
                        payload.studentSubjects = pickedSubjects;
                        payload.studentLevel = studentLevelEl?.value || '';
                    } else if (role === 'tutor') {
                        payload.tutorSubjects = pickedSubjects;
                    }
                } else {
                    payload = { email, password };
                }

                const result = await apiRequest(mode === 'register' ? '/auth/register' : '/auth/login', {
                    method: 'POST',
                    body: payload,
                    auth: false,
                });

                setAuth({ token: result.token, user: result.user });
                sessionStorage.removeItem('tutorly_selected_tutor');

                if (result.user.role === 'admin') {
                    navigateTo('admin');
                } else if (result.user.role === 'tutor') {
                    navigateTo('dashboard');
                } else {
                    navigateTo('search');
                }
            } catch (err) {
                if (errorEl) {
                    const msg = err?.message || 'Unable to continue';
                    if (msg === 'Failed to fetch') {
                        const host = window.location.hostname.toLowerCase();
                        const isLocal =
                            host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
                        errorEl.textContent = isLocal
                            ? 'Cannot reach server. Is the API running on port 7503?'
                            : 'Cannot reach server. Confirm the API is proxied on this host (HTTPS, same origin), or set window.TUTORLY_API_BASE.';
                    } else {
                        errorEl.textContent = msg;
                    }
                    errorEl.classList.add('visible');
                }
            } finally {
                setSubmittingState(false);
            }
        });
    }

    // Search page: load courses + tutors from API
    if (currentFromPath === 'search') {
        const queryInput = document.getElementById('search-query');
        const subjectSelect = document.getElementById('search-subject');
        const priceSelect = document.getElementById('search-price');
        const searchBtn = document.getElementById('search-btn');
        const grid = document.getElementById('tutor-grid');
        const loadingEl = document.getElementById('search-loading');
        const emptyEl = document.getElementById('search-empty');
        const filterSummaryEl = document.getElementById('search-filter-summary');
        let allTutors = [];
        let isSearching = false;

        function setSearchLoading(isLoading) {
            isSearching = isLoading;
            if (loadingEl) loadingEl.style.display = isLoading ? 'block' : 'none';
            if (searchBtn) {
                searchBtn.disabled = isLoading;
                searchBtn.classList.toggle('is-loading', isLoading);
            }
        }

        function tutorMatchesPriceFilter(tutor, range) {
            const hourlyRate = Number(tutor.hourlyRate || 0);
            if (!range) return true;
            if (range === '20-40') return hourlyRate >= 20 && hourlyRate <= 40;
            if (range === '40-60') return hourlyRate >= 40 && hourlyRate <= 60;
            if (range === '60+') return hourlyRate >= 60;
            return true;
        }

        function updateFilterSummary(count) {
            if (!filterSummaryEl) return;
            const activeFilters = [];
            if (queryInput?.value.trim()) activeFilters.push(`search: "${queryInput.value.trim()}"`);
            if (subjectSelect?.value) {
                const selectedSubjectLabel = subjectSelect.options[subjectSelect.selectedIndex]?.textContent || subjectSelect.value;
                activeFilters.push(`subject: ${selectedSubjectLabel}`);
            }
            if (priceSelect?.value) {
                const selectedPriceLabel = priceSelect.options[priceSelect.selectedIndex]?.textContent || priceSelect.value;
                activeFilters.push(`price: ${selectedPriceLabel}`);
            }
            if (activeFilters.length === 0) {
                filterSummaryEl.innerHTML = `Showing <strong>${count}</strong> tutor${count === 1 ? '' : 's'} (all results)`;
                return;
            }
            filterSummaryEl.innerHTML = `Showing <strong>${count}</strong> tutor${count === 1 ? '' : 's'} for ${activeFilters.join(' • ')}`;
        }

        function renderTutorResults(tutors) {
            if (!grid || !emptyEl) return;
            emptyEl.style.display = 'none';
            if (tutors.length === 0) {
                grid.innerHTML = '';
                emptyEl.textContent = 'No tutors match your current filters. Try broadening your search.';
                emptyEl.style.display = 'block';
                updateFilterSummary(0);
                return;
            }
            grid.innerHTML = tutors.map(t => {
                const initials = (t.fullName || 'T').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                const rating = (t.averageRating || 4.5).toFixed(1);
                const subs = (t.subjects || []).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ');
                const dataAttr = "data-tutor-id=\"" + t.id + "\"";
                return `<div class="tutor-card" ${dataAttr} data-navigate="profile">
                    <div class="tutor-header">
                        <div class="tutor-avatar">${initials}</div>
                        <div class="tutor-info">
                            <h3>${t.fullName || 'Tutor'}</h3>
                            <div class="tutor-subject">${subs || 'Tutor'} • ${t.yearsExperience || 0} years</div>
                        </div>
                    </div>
                    <div class="tutor-rating">
                        <i class="fas fa-star"></i><span style="color:#6b7280;margin-left:5px;">${rating} (${t.reviewCount || 0} reviews)</span>
                    </div>
                    <p style="color:#6b7280;margin:10px 0;">${t.bio || 'No bio yet.'}</p>
                    <div class="tutor-price">$${t.hourlyRate || 0}/hr</div>
                    <div class="verification-badge"><i class="fas fa-check-circle"></i> Verified</div>
                </div>`;
            }).join('');
            updateFilterSummary(tutors.length);
        }

        function applyClientFiltersAndRender() {
            const query = queryInput?.value.trim().toLowerCase() || '';
            const selectedSubject = subjectSelect?.value || '';
            const selectedPrice = priceSelect?.value || '';
            const filtered = allTutors.filter((tutor) => {
                const tutorName = (tutor.fullName || '').toLowerCase();
                const tutorSubjects = (tutor.subjects || []).map(s => (s || '').toLowerCase());
                const matchesQuery = !query || tutorName.includes(query) || tutorSubjects.some(s => s.includes(query));
                const matchesSubject = !selectedSubject || tutorSubjects.includes(selectedSubject.toLowerCase());
                const matchesPrice = tutorMatchesPriceFilter(tutor, selectedPrice);
                return matchesQuery && matchesSubject && matchesPrice;
            });
            renderTutorResults(filtered);
        }

        async function loadSearch() {
            if (isSearching) return;
            setSearchLoading(true);
            emptyEl && (emptyEl.style.display = 'none');
            grid && (grid.innerHTML = '');

            try {
                const previousSubject = subjectSelect?.value || '';
                const [coursesRes, tutorsRes] = await Promise.all([
                    apiRequest('/courses', { auth: false }),
                    apiRequest('/tutors' + (subjectSelect?.value ? '?subject=' + encodeURIComponent(subjectSelect.value) : ''), { auth: false }),
                ]);

                if (subjectSelect && coursesRes.courses) {
                    subjectSelect.innerHTML = '<option value="">All Subjects</option>' +
                        coursesRes.courses.map(c => `<option value="${c.slug}">${c.name}</option>`).join('');
                    subjectSelect.value = previousSubject;
                }

                allTutors = tutorsRes.tutors || [];
                window.__tutorlyTutors = allTutors;
                applyClientFiltersAndRender();
            } catch (err) {
                if (emptyEl) {
                    emptyEl.textContent = 'Could not load tutors. Is the API running?';
                    emptyEl.style.display = 'block';
                }
                if (filterSummaryEl) filterSummaryEl.textContent = 'Unable to refresh tutor discovery right now.';
            } finally {
                setSearchLoading(false);
            }
        }

        loadSearch();
        searchBtn?.addEventListener('click', loadSearch);
        queryInput?.addEventListener('input', applyClientFiltersAndRender);
        priceSelect?.addEventListener('change', applyClientFiltersAndRender);
        subjectSelect?.addEventListener('change', loadSearch);
    }

    // Profile page: render selected tutor
    if (currentFromPath === 'profile') {
        const container = document.getElementById('profile-content');
        const { selectedTutor } = getFlowState();
        if (container && selectedTutor) {
            const initials = (selectedTutor.fullName || 'T').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
            const subs = (selectedTutor.subjects || []).map(s => '<span class="subject-tag">' + (s.charAt(0).toUpperCase() + s.slice(1)) + '</span>').join(' ');
            container.innerHTML = `
                <aside class="profile-sidebar">
                    <div class="profile-avatar-large">${initials}</div>
                    <h2 style="text-align:center;color:#1e293b">${selectedTutor.fullName || 'Tutor'}</h2>
                    <p style="text-align:center;color:#6366f1;font-weight:600">${(selectedTutor.subjects || []).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ') || 'Tutor'}</p>
                    <div class="profile-stats">
                        <div class="stat"><div class="stat-value">${(selectedTutor.averageRating || 4.5).toFixed(1)}</div><div class="stat-label">Rating</div></div>
                        <div class="stat"><div class="stat-value">${selectedTutor.reviewCount || 0}</div><div class="stat-label">Reviews</div></div>
                        <div class="stat"><div class="stat-value">${selectedTutor.yearsExperience || 0}+</div><div class="stat-label">Years</div></div>
                    </div>
                    <div style="margin:25px 0">
                        <h3 style="color:#1e293b;margin-bottom:10px">Subjects</h3>
                        <div>${subs || '<span class="subject-tag">General</span>'}</div>
                    </div>
                    <div style="margin:25px 0">
                        <h3 style="color:#1e293b;margin-bottom:10px">Hourly Rate</h3>
                        <div style="font-size:32px;font-weight:800;color:#10b981">$${selectedTutor.hourlyRate || 0}/hr</div>
                    </div>
                    <button class="btn-primary" data-navigate="booking"><i class="fas fa-calendar-check"></i> Book Session</button>
                </aside>
                <div class="profile-main">
                    <h3 style="color:#1e293b;margin-bottom:15px">About</h3>
                    <p style="color:#64748b;line-height:1.6;margin-bottom:25px">${selectedTutor.bio || 'No bio provided yet.'}</p>
                    <h3 style="color:#1e293b;margin-bottom:15px">Availability</h3>
                    <p style="color:#64748b;margin-bottom:25px"><i class="fas fa-calendar-alt" style="color:#6366f1"></i> <strong>Next available:</strong> Various slots - book to confirm</p>
                </div>
            `;
            container.querySelector('[data-navigate="booking"]')?.addEventListener('click', () => {
                if (isAllowed('booking')) navigateTo('booking');
            });
        }
    }

    // Booking page: load tutor slots, reserve booking, then mock payment
    if (currentFromPath === 'booking') {
        const summary = document.getElementById('booking-tutor-summary');
        const summaryRate = document.getElementById('booking-rate');
        const summaryTotal = document.getElementById('booking-total');
        const summaryFee = document.getElementById('booking-fee');
        const summarySubtotal = document.getElementById('booking-subtotal');
        const summaryTime = document.getElementById('summary-time');
        const summaryDuration = document.getElementById('summary-duration');
        const bookingErrorEl = document.getElementById('booking-error');
        const bookingConfirmationEl = document.getElementById('booking-confirmation');
        const slotsLoadingEl = document.getElementById('slots-loading');
        const slotsEmptyEl = document.getElementById('slots-empty');
        const slotsRangeLabel = document.getElementById('slots-range-label');
        const timeSlotsEl = document.getElementById('time-slots');
        const reserveBtn = document.getElementById('booking-reserve-btn');
        const payBtn = document.getElementById('booking-pay-btn');
        const postReserveEl = document.getElementById('booking-post-reserve');
        const paymentBanner = document.getElementById('payment-banner');
        const subjectInput = document.getElementById('booking-subject');
        const paymentMethodEl = document.getElementById('payment-method');
        const { selectedTutor } = getFlowState();

        let slotsData = [];
        let selectedSlot = null;
        let pendingBooking = null;
        let saving = false;

        function setBookingError(message) {
            if (!bookingErrorEl) return;
            bookingErrorEl.textContent = message || '';
            bookingErrorEl.classList.toggle('visible', !!message);
        }

        function setPaymentBanner(type, message) {
            if (!paymentBanner) return;
            paymentBanner.textContent = message || '';
            paymentBanner.classList.remove('payment-banner--ok', 'payment-banner--err');
            if (type === 'ok') paymentBanner.classList.add('payment-banner--ok');
            if (type === 'err') paymentBanner.classList.add('payment-banner--err');
            paymentBanner.style.display = message ? 'block' : 'none';
        }

        function setBookingConfirmation(html) {
            if (!bookingConfirmationEl) return;
            bookingConfirmationEl.innerHTML = html || '';
        }

        function updateBookingTotals(rate, durationMinutes) {
            const subtotal = rate * (durationMinutes / 60);
            const fee = Math.round(subtotal * 0.1 * 100) / 100;
            const total = subtotal + fee;
            if (summaryRate) summaryRate.textContent = '$' + rate + '/hour';
            if (summarySubtotal) summarySubtotal.textContent = '$' + subtotal.toFixed(2);
            if (summaryFee) summaryFee.textContent = '$' + fee.toFixed(2);
            if (summaryTotal) summaryTotal.textContent = '$' + total.toFixed(2);
        }

        function refreshSummaryFromSlot() {
            const rate = selectedTutor?.hourlyRate || 0;
            if (!selectedSlot) {
                if (summaryTime) summaryTime.textContent = '-';
                if (summaryDuration) summaryDuration.textContent = '-';
                updateBookingTotals(rate, 60);
                return;
            }
            const start = new Date(selectedSlot.startAt);
            const timeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            const dateStr = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            if (summaryTime) summaryTime.textContent = `${dateStr} · ${timeStr}`;
            const dm = Number(selectedSlot.durationMinutes) || 60;
            if (summaryDuration) summaryDuration.textContent = `${dm} minutes`;
            updateBookingTotals(rate, dm);
        }

        function renderSlotButtons() {
            if (!timeSlotsEl) return;
            timeSlotsEl.innerHTML = '';
            if (!slotsData.length) return;
            slotsData.forEach((slot) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'time-slot' + (slot.available === false ? ' unavailable' : '');
                btn.dataset.slotId = slot.id;
                const start = new Date(slot.startAt);
                const label = start.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
                btn.textContent = slot.available === false ? `${label} (taken)` : label;
                btn.setAttribute('aria-disabled', slot.available === false ? 'true' : 'false');
                btn.addEventListener('click', () => {
                    if (slot.available === false) {
                        setBookingError('That slot was just taken. Please pick another time.');
                        return;
                    }
                    setBookingError('');
                    setPaymentBanner('', '');
                    timeSlotsEl.querySelectorAll('.time-slot').forEach((el) => el.classList.remove('selected'));
                    btn.classList.add('selected');
                    selectedSlot = slot;
                    refreshSummaryFromSlot();
                });
                timeSlotsEl.appendChild(btn);
            });
        }

        async function loadSlots() {
            if (!selectedTutor?.id) return;
            const from = new Date();
            from.setHours(0, 0, 0, 0);
            const to = new Date(from);
            to.setDate(to.getDate() + 21);
            if (slotsRangeLabel) {
                slotsRangeLabel.textContent = `Showing ${from.toLocaleDateString()} - ${to.toLocaleDateString()}`;
            }
            if (slotsLoadingEl) slotsLoadingEl.style.display = 'block';
            if (slotsEmptyEl) slotsEmptyEl.style.display = 'none';
            try {
                const res = await apiRequest(
                    `/tutors/${encodeURIComponent(selectedTutor.id)}/slots?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
                    { auth: false },
                );
                slotsData = res.slots || [];
                if (slotsLoadingEl) slotsLoadingEl.style.display = 'none';
                if (!slotsData.length && slotsEmptyEl) {
                    slotsEmptyEl.style.display = 'block';
                }
                renderSlotButtons();
            } catch (e) {
                if (slotsLoadingEl) slotsLoadingEl.style.display = 'none';
                setBookingError(e?.message || 'Could not load availability.');
            }
        }

        if (summary && selectedTutor) {
            const initials = (selectedTutor.fullName || 'T').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
            summary.innerHTML = `
                <div class="tutor-avatar" style="width:50px;height:50px;font-size:18px">${initials}</div>
                <div style="margin-left:15px">
                    <h4 style="color:#1e293b;margin:0">${selectedTutor.fullName || 'Tutor'}</h4>
                    <div style="color:#64748b;font-size:14px">${(selectedTutor.subjects || []).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ') || 'Tutor'}</div>
                </div>
            `;
            refreshSummaryFromSlot();
            loadSlots();
        } else {
            setBookingError('Select a tutor from Find Tutor before booking.');
            if (reserveBtn) reserveBtn.disabled = true;
        }

        reserveBtn?.addEventListener('click', async () => {
            setBookingError('');
            setPaymentBanner('', '');
            if (!selectedTutor) {
                setBookingError('Choose a tutor first.');
                return;
            }
            if (!selectedSlot || selectedSlot.available === false) {
                setBookingError('Please select an available time slot.');
                return;
            }
            const { token, user } = getAuth();
            if (!token || user?.role !== 'student') {
                setBookingError('Please sign in as a student to reserve a session.');
                return;
            }
            if (saving) return;
            saving = true;
            reserveBtn.disabled = true;
            reserveBtn.classList.add('is-loading');
            try {
                const subject = (subjectInput?.value || '').trim();
                const body = {
                    tutorId: selectedTutor.id,
                    slotId: selectedSlot.id,
                    subject: subject || (selectedTutor.subjects && selectedTutor.subjects[0]) || 'Tutoring session',
                };
                const res = await apiRequest('/bookings', { method: 'POST', body });
                pendingBooking = res.booking;
                sessionStorage.setItem('tutorly_pending_booking', JSON.stringify(pendingBooking));
                setBookingConfirmation(`
                    <strong>Reservation received</strong>
                    <p style="margin:8px 0 0;color:#475569;font-size:14px;">Booking ID: <code>${pendingBooking.id}</code></p>
                    <p style="margin:6px 0 0;color:#475569;font-size:14px;">Status: <span class="status-badge status-badge--pending">Pending payment</span></p>
                `);
                if (postReserveEl) postReserveEl.style.display = 'block';
                reserveBtn.style.display = 'none';
            } catch (err) {
                const code = err?.payload?.error;
                if (code === 'SLOT_TAKEN' || err?.status === 409) {
                    setBookingError('That slot is no longer available. Please choose another time.');
                    await loadSlots();
                } else {
                    setBookingError(err?.message || 'Could not create booking.');
                }
                reserveBtn.disabled = false;
            } finally {
                saving = false;
                reserveBtn?.classList.remove('is-loading');
            }
        });

        payBtn?.addEventListener('click', async () => {
            setBookingError('');
            setPaymentBanner('', '');
            const raw = sessionStorage.getItem('tutorly_pending_booking');
            const booking = pendingBooking || (raw ? JSON.parse(raw) : null);
            if (!booking?.id) {
                setBookingError('No pending booking. Reserve a session first.');
                return;
            }
            if (saving) return;
            saving = true;
            payBtn.disabled = true;
            payBtn.classList.add('is-loading');
            const method = paymentMethodEl?.value || 'card';
            try {
                const res = await apiRequest('/payments', {
                    method: 'POST',
                    body: { bookingId: booking.id, method },
                });
                setPaymentBanner('ok', res.success ? 'Payment successful. Your session is confirmed.' : 'Confirmed.');
                sessionStorage.setItem('tutorly_last_booking', JSON.stringify(res.booking));
                sessionStorage.removeItem('tutorly_pending_booking');
                window.setTimeout(() => navigateTo('dashboard'), 900);
            } catch (err) {
                if (err?.status === 402) {
                    setPaymentBanner('err', err?.message || 'Payment was declined. Your booking stays pending.');
                } else {
                    setBookingError(err?.message || 'Payment failed.');
                }
                payBtn.disabled = false;
            } finally {
                saving = false;
                payBtn?.classList.remove('is-loading');
            }
        });
    }

    // Dashboard page: load live data for tutors, show student prompt otherwise
    if (currentFromPath === 'dashboard') {
        const tutorSection = document.getElementById('dashboard-tutor');
        const studentSection = document.getElementById('dashboard-student');
        const { token, user } = getAuth();

        if (token && user && user.role === 'tutor') {
            tutorSection.style.display = 'block';
            studentSection.style.display = 'none';

            const avatarEl = document.getElementById('dashboard-avatar');
            const nameEl = document.getElementById('dashboard-name');
            const subjectsEl = document.getElementById('dashboard-subjects');
            const statusEl = document.getElementById('dashboard-status');
            const statEarnings = document.getElementById('stat-earnings');
            const statUpcoming = document.getElementById('stat-upcoming');
            const statRating = document.getElementById('stat-rating');
            const statRate = document.getElementById('stat-rate');
            const sessionsList = document.getElementById('dashboard-sessions-list');
            const tutorBookingHighlightId = new URLSearchParams(window.location.search).get('booking');

            async function loadDashboard() {
                try {
                    const [meRes, bookingsRes] = await Promise.all([
                        apiRequest('/tutors/me'),
                        apiRequest('/tutors/me/bookings'),
                    ]);
                    const { tutor, stats } = meRes;
                    const bookings = bookingsRes.bookings || [];

                    const initials = (tutor.fullName || 'T').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                    const subs = (tutor.subjects || []).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ') || 'No subjects';
                    const status = tutor.verificationStatus || 'pending';

                    if (avatarEl) avatarEl.textContent = initials;
                    if (nameEl) nameEl.textContent = tutor.fullName || 'Tutor';
                    if (subjectsEl) subjectsEl.textContent = subs;
                    if (statusEl) {
                        statusEl.textContent = status.charAt(0).toUpperCase() + status.slice(1);
                        statusEl.className = 'verification-badge' + (status === 'approved' ? '' : ' verification-pending');
                    }
                    if (statEarnings) statEarnings.textContent = '$' + (stats?.earningsThisMonth ?? 0).toFixed(2);
                    // Matches `/tutors/me/bookings`: future sessions excluding cancelled/completed.
                    if (statUpcoming) statUpcoming.textContent = String(bookings.length);
                    if (statRating) statRating.textContent = (tutor.averageRating ?? 0) > 0 ? (tutor.averageRating || 0).toFixed(1) : '-';
                    if (statRate) statRate.textContent = (stats?.bookingRate ?? 0) > 0 ? (stats.bookingRate + '%') : '-';

                    if (bookings.length === 0) {
                        sessionsList.innerHTML = '<p class="search-empty">No upcoming sessions</p>';
                    } else {
                        sessionsList.innerHTML = bookings.map((b) => {
                            const start = new Date(b.startAt);
                            const end = new Date(start.getTime() + (b.durationMinutes || 60) * 60000);
                            const timeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + ' - ' + end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                            const dateStr = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                            const st = (b.status || 'confirmed').toLowerCase();
                            const badgeClass = st === 'confirmed' ? 'status-badge status-badge--ok' : st === 'pending' ? 'status-badge status-badge--pending' : 'status-badge';
                            const join = b.meetingLink && st === 'confirmed'
                                ? `<a class="nav-btn session-join-link" href="${b.meetingLink}" target="_blank" rel="noopener noreferrer"><i class="fas fa-video"></i> Join</a>`
                                : `<button type="button" class="nav-btn" style="background:#f1f5f9;color:#94a3b8" disabled title="Available after payment confirms"><i class="fas fa-video"></i> Join</button>`;
                            const bookingMeta = `<div class="booking-session-meta"><span class="booking-session-meta-id">${shortBookingRef(b.id)}</span><a class="booking-ref-link" href="${bookingDetailPageHref(b.id)}">Details</a></div>`;
                            return `<div class="session-item booking-session-row" data-booking-id="${b.id}">
                                <div><div style="font-weight:600">${b.studentName || 'Student'}</div><div style="color:#6b7280;font-size:14px">${b.subject || 'Session'}</div>${bookingMeta}</div>
                                <div><div style="font-weight:600">${dateStr} • ${timeStr}</div><div style="margin-top:4px"><span class="${badgeClass}">${st.charAt(0).toUpperCase() + st.slice(1)}</span></div></div>
                                ${join}
                            </div>`;
                        }).join('');
                    }

                    highlightDashboardBookingRow(sessionsList, tutorBookingHighlightId);

                    window.__tutorlyDashboardTutor = tutor;
                } catch (err) {
                    sessionsList.innerHTML = '<p class="search-empty">Could not load dashboard. ' + (err?.message || 'Try again.') + '</p>';
                }
            }

            loadDashboard();

            // Edit Profile modal
            const modal = document.getElementById('edit-profile-modal');
            const editBtn = document.getElementById('dashboard-edit-btn');
            const closeBtn = document.getElementById('edit-profile-close');
            const cancelBtn = document.getElementById('edit-profile-cancel');
            const form = document.getElementById('edit-profile-form');
            const editError = document.getElementById('edit-profile-error');
            const courses = [{ slug: 'mathematics', name: 'Mathematics' }, { slug: 'physics', name: 'Physics' }, { slug: 'chemistry', name: 'Chemistry' }, { slug: 'english', name: 'English' }, { slug: 'computer-science', name: 'Computer Science' }, { slug: 'biology', name: 'Biology' }];

            function openEditModal() {
                const t = window.__tutorlyDashboardTutor;
                if (!t) return;
                document.getElementById('edit-fullName').value = t.fullName || '';
                document.getElementById('edit-bio').value = t.bio || '';
                document.getElementById('edit-hourlyRate').value = t.hourlyRate ?? '';
                document.getElementById('edit-yearsExperience').value = t.yearsExperience ?? '';
                const wrap = document.getElementById('edit-subjects-wrap');
                wrap.innerHTML = (t.subjects || []).map(s => {
                    const name = (s.charAt(0).toUpperCase() + s.slice(1)).replace(/-/g, ' ');
                    return `<span class="subject-tag" data-subject="${s}">${name} <button type="button" class="chip-remove" aria-label="Remove">×</button></span>`;
                }).join('');
                wrap.querySelectorAll('.chip-remove').forEach(btn => {
                    btn.addEventListener('click', () => btn.closest('.subject-tag')?.remove());
                });
                modal.style.display = 'flex';
            }

            function closeEditModal() {
                modal.style.display = 'none';
                editError.textContent = '';
                editError.classList.remove('visible');
            }

            editBtn?.addEventListener('click', openEditModal);
            closeBtn?.addEventListener('click', closeEditModal);
            cancelBtn?.addEventListener('click', closeEditModal);
            modal?.addEventListener('click', (e) => { if (e.target === modal) closeEditModal(); });

            document.getElementById('edit-subjects-add')?.addEventListener('change', function() {
                const v = this.value;
                if (!v) return;
                const wrap = document.getElementById('edit-subjects-wrap');
                if (wrap.querySelector(`[data-subject="${v}"]`)) return;
                const name = (v.charAt(0).toUpperCase() + v.slice(1)).replace(/-/g, ' ');
                const span = document.createElement('span');
                span.className = 'subject-tag';
                span.dataset.subject = v;
                span.innerHTML = name + ' <button type="button" class="chip-remove" aria-label="Remove">×</button>';
                span.querySelector('.chip-remove').addEventListener('click', () => span.remove());
                wrap.appendChild(span);
                this.value = '';
            });

            form?.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (editError) { editError.textContent = ''; editError.classList.remove('visible'); }
                const fullName = document.getElementById('edit-fullName').value.trim();
                const bio = document.getElementById('edit-bio').value.trim();
                const hourlyRate = parseInt(document.getElementById('edit-hourlyRate').value, 10) || 0;
                const yearsExperience = parseInt(document.getElementById('edit-yearsExperience').value, 10) || 0;
                const subjects = Array.from(document.getElementById('edit-subjects-wrap').querySelectorAll('[data-subject]')).map(el => el.dataset.subject);
                try {
                    const res = await apiRequest('/tutors/me', {
                        method: 'PATCH',
                        body: { fullName, bio, hourlyRate, yearsExperience, subjects },
                    });
                    window.__tutorlyDashboardTutor = res.tutor;
                    setAuth({ token: getAuth().token, user: { ...user, fullName: res.tutor.fullName } });
                    closeEditModal();
                    loadDashboard();
                } catch (err) {
                    if (editError) {
                        editError.textContent = err?.message || 'Failed to save';
                        editError.classList.add('visible');
                    }
                }
            });
        } else {
            tutorSection.style.display = 'none';
            studentSection.style.display = 'block';

            const studentBookingsEl = document.getElementById('dashboard-student-bookings');
            const studentBanner = document.getElementById('dashboard-student-banner');

            if (token && user && user.role === 'student') {
                const studentBookingHighlightId = new URLSearchParams(window.location.search).get('booking');
                const prefsWrap = document.getElementById('dashboard-student-prefs');
                const prefsView = document.getElementById('dashboard-student-prefs-view');
                const prefsForm = document.getElementById('dashboard-student-prefs-form');
                const prefsSummary = document.getElementById('dashboard-student-prefs-summary');
                const prefsEditBtn = document.getElementById('dashboard-student-prefs-edit');
                const prefsCancel = document.getElementById('dashboard-prefs-cancel');
                const prefsError = document.getElementById('dashboard-prefs-error');
                const prefsLevel = document.getElementById('dashboard-prefs-level');

                function renderStudentPrefsSummary(u) {
                    if (!prefsSummary) return;
                    const subs = (u.studentSubjects || []).map(formatSubjectSlugLabel).join(', ') || 'None selected';
                    const lvl = STUDENT_LEVEL_LABELS[u.studentLevel] || formatSubjectSlugLabel(u.studentLevel) || '-';
                    prefsSummary.textContent = `Subjects: ${subs}. Level: ${lvl}.`;
                }

                function syncStudentPrefsFormFromUser(u) {
                    document.querySelectorAll('input[name="dashboard-pref-subject"]').forEach((cb) => {
                        cb.checked = (u.studentSubjects || []).includes(cb.value);
                    });
                    if (prefsLevel) prefsLevel.value = u.studentLevel || '';
                }

                function showStudentPrefsView() {
                    if (prefsForm) prefsForm.style.display = 'none';
                    if (prefsView) prefsView.style.display = '';
                    if (prefsError) prefsError.textContent = '';
                }

                async function loadStudentLearningPrefs() {
                    if (prefsWrap) prefsWrap.style.display = 'block';
                    let u = { ...user };
                    try {
                        const me = await apiRequest('/auth/me');
                        u = { ...u, ...me.user };
                        setAuth({ token, user: u });
                    } catch {
                        u = { ...u, studentSubjects: u.studentSubjects || [], studentLevel: u.studentLevel || '' };
                    }
                    renderStudentPrefsSummary(u);
                    syncStudentPrefsFormFromUser(u);
                }

                prefsEditBtn?.addEventListener('click', () => {
                    syncStudentPrefsFormFromUser(getAuth().user);
                    if (prefsError) prefsError.textContent = '';
                    if (prefsView) prefsView.style.display = 'none';
                    if (prefsForm) prefsForm.style.display = 'block';
                });

                prefsCancel?.addEventListener('click', showStudentPrefsView);

                prefsForm?.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    if (prefsError) prefsError.textContent = '';
                    const studentSubjects = Array.from(document.querySelectorAll('input[name="dashboard-pref-subject"]:checked')).map((cb) => cb.value);
                    const studentLevel = prefsLevel?.value || '';
                    if (studentSubjects.length < 1) {
                        if (prefsError) prefsError.textContent = 'Select at least one subject.';
                        return;
                    }
                    if (!studentLevel) {
                        if (prefsError) prefsError.textContent = 'Select an education level.';
                        return;
                    }
                    try {
                        const res = await apiRequest('/auth/me', {
                            method: 'PATCH',
                            body: { studentSubjects, studentLevel },
                        });
                        setAuth({ token: getAuth().token, user: { ...getAuth().user, ...res.user } });
                        renderStudentPrefsSummary(res.user);
                        showStudentPrefsView();
                    } catch (err) {
                        if (prefsError) prefsError.textContent = err?.message || 'Could not save preferences.';
                    }
                });

                const lastRaw = sessionStorage.getItem('tutorly_last_booking');
                if (lastRaw && studentBanner) {
                    try {
                        const b = JSON.parse(lastRaw);
                        const when = new Date(b.startAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
                        studentBanner.innerHTML = `<div class="payment-banner payment-banner--ok"><strong>You're all set.</strong> Session scheduled for ${when}.${b.meetingLink ? ` <a href="${b.meetingLink}" target="_blank" rel="noopener">Open meeting link</a>` : ''}</div>`;
                        studentBanner.style.display = 'block';
                        sessionStorage.removeItem('tutorly_last_booking');
                    } catch {
                        /* ignore */
                    }
                }

                loadStudentLearningPrefs();

                function renderStudentSessionRow(b) {
                    const start = new Date(b.startAt);
                    const end = new Date(start.getTime() + (b.durationMinutes || 60) * 60000);
                    const timeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + ' – ' + end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                    const dateStr = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                    const st = (b.status || '').toLowerCase();
                    const badgeClass = st === 'confirmed' ? 'status-badge status-badge--ok' : st === 'pending' ? 'status-badge status-badge--pending' : 'status-badge';
                    const join = b.meetingLink && st === 'confirmed'
                        ? `<a class="btn-secondary session-join-link" href="${b.meetingLink}" target="_blank" rel="noopener noreferrer"><i class="fas fa-video"></i> Join</a>`
                        : `<button type="button" class="btn-secondary" disabled style="opacity:0.6"><i class="fas fa-video"></i> Join</button>`;
                    const bookingMeta = `<div class="booking-session-meta"><span class="booking-session-meta-id">${shortBookingRef(b.id)}</span><a class="booking-ref-link" href="${bookingDetailPageHref(b.id)}">Details</a></div>`;
                    return `<div class="session-item dashboard-student-session booking-session-row" data-booking-id="${b.id}">
                                <div><div style="font-weight:600">${b.tutorName || 'Tutor'}</div><div style="color:#6b7280;font-size:14px">${b.subject || 'Session'}</div>${bookingMeta}</div>
                                <div><div style="font-weight:600">${dateStr} · ${timeStr}</div><div style="margin-top:4px"><span class="${badgeClass}">${st ? st.charAt(0).toUpperCase() + st.slice(1) : '-'}</span></div></div>
                                ${join}
                            </div>`;
                }

                async function loadStudentDashboard() {
                    if (!studentBookingsEl) return;
                    studentBookingsEl.innerHTML = '<p class="search-empty">Loading your sessions…</p>';
                    try {
                        const [upRes, pastRes] = await Promise.all([
                            apiRequest('/bookings/me?upcoming=1'),
                            apiRequest('/bookings/me?past=1'),
                        ]);
                        const upcoming = upRes.bookings || [];
                        const pastRaw = pastRes.bookings || [];
                        const upcomingIds = new Set(upcoming.map((b) => b.id));
                        const past = pastRaw.filter((b) => !upcomingIds.has(b.id));

                        if (upcoming.length === 0 && past.length === 0) {
                            studentBookingsEl.innerHTML = '<p class="search-empty">No sessions yet. Use Find Tutor to book your first lesson.</p>';
                            return;
                        }

                        let html = '';
                        html += '<h3 class="dashboard-student-heading">Upcoming sessions</h3>';
                        if (upcoming.length === 0) {
                            html += '<p class="search-empty dashboard-bookings-empty">No upcoming sessions.</p>';
                        } else {
                            html += upcoming.map(renderStudentSessionRow).join('');
                        }
                        html += '<h3 class="dashboard-student-heading dashboard-past-heading">Past sessions</h3>';
                        if (past.length === 0) {
                            html += '<p class="search-empty dashboard-bookings-empty">No past sessions yet.</p>';
                        } else {
                            html += past.map(renderStudentSessionRow).join('');
                        }
                        studentBookingsEl.innerHTML = html;
                        highlightDashboardBookingRow(studentBookingsEl, studentBookingHighlightId);
                    } catch (e) {
                        studentBookingsEl.innerHTML = '<p class="search-empty">' + (e.message || 'Could not load sessions.') + '</p>';
                    }
                }
                loadStudentDashboard();
            } else if (studentBookingsEl) {
                studentBookingsEl.innerHTML = '';
            }
        }
    }

    // Add keyboard navigation (optional)
    document.addEventListener('keydown', (e) => {
        // Left/right arrow keys for navigation between screens
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            const currentScreen = getCurrentScreenIdFromPath() ?? document.querySelector('.screen.active')?.id;
            if (currentScreen) {
                const currentIndex = SCREEN_ORDER.indexOf(currentScreen);
                let newIndex;
                
                if (e.key === 'ArrowLeft' && currentIndex > 0) {
                    newIndex = currentIndex - 1;
                } else if (e.key === 'ArrowRight' && currentIndex < SCREEN_ORDER.length - 1) {
                    newIndex = currentIndex + 1;
                }
                
                if (newIndex !== undefined) {
                    const next = SCREEN_ORDER[newIndex];
                    if (SCREEN_TO_PAGE[next]) {
                        navigateTo(next);
                    } else {
                        showScreen(next);
                    }
                }
            }
        }
    });
});

// ===== EXPORT FOR MODULE USE (if needed in future) =====
// If using modules, uncomment below:
// export { showScreen, selectTimeSlot };