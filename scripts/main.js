/**
 * Tutorly - Main JavaScript File
 * Handles navigation, UI interactions, and dynamic updates
 */

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

const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:8787`;

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
            else if (screenId === 'dashboard' && user?.role === 'admin') btn.title = 'Admins use the Admin portal';
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
            selectTimeSlot(slot);
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
        const studentPrefs = document.getElementById('student-preferences');
        const studentLevelGroup = document.getElementById('student-level-group');
        const fullNameEl = document.getElementById('auth-full-name');
        const emailEl = document.getElementById('auth-email');
        const passwordEl = document.getElementById('auth-password');
        const roleEl = document.getElementById('auth-role');
        const submitEl = document.getElementById('auth-submit');
        const errorEl = document.getElementById('auth-error');
        const switchText = document.getElementById('auth-switch-text');
        const switchBtn = document.getElementById('auth-switch-to-login');

        const urlMode = new URLSearchParams(window.location.search).get('mode');
        let mode = (urlMode === 'login' || urlMode === 'register') ? urlMode : 'login';

        function applyMode() {
            document.querySelectorAll('.auth-tab').forEach(t => {
                t.setAttribute('aria-pressed', t === (mode === 'register' ? modeRegisterBtn : modeLoginBtn) ? 'true' : 'false');
                t.classList.toggle('active', t === (mode === 'register' ? modeRegisterBtn : modeLoginBtn));
            });
            if (registerFields) registerFields.style.display = mode === 'register' ? '' : 'none';
            if (submitEl) submitEl.textContent = mode === 'register' ? 'Create Account' : 'Sign In';
            if (switchText) {
                if (mode === 'register') {
                    switchText.innerHTML = 'Already have an account? <button type="button" class="auth-link">Sign in</button>';
                } else {
                    switchText.innerHTML = 'Don\'t have an account? <button type="button" class="auth-link">Create one</button>';
                }
            }
            if (roleEl) updateStudentPrefsVisibility();
        }

        function updateStudentPrefsVisibility() {
            const isStudent = roleEl?.value === 'student';
            if (studentPrefs) studentPrefs.style.display = mode === 'register' && isStudent ? '' : 'none';
            if (studentLevelGroup) studentLevelGroup.style.display = mode === 'register' && isStudent ? '' : 'none';
        }

        modeRegisterBtn?.addEventListener('click', () => { mode = 'register'; applyMode(); });
        modeLoginBtn?.addEventListener('click', () => { mode = 'login'; applyMode(); });
        roleEl?.addEventListener('change', updateStudentPrefsVisibility);
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

            const email = emailEl.value.trim();
            const password = passwordEl.value;
            const fullName = fullNameEl?.value?.trim();
            const role = roleEl?.value ?? 'student';

            try {
                submitEl.disabled = true;
                const payload = mode === 'register'
                    ? { fullName, email, password, role }
                    : { email, password };

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
                    errorEl.textContent = msg === 'Failed to fetch' ? 'Cannot reach server. Is the API running on port 8787?' : msg;
                    errorEl.classList.add('visible');
                }
            } finally {
                submitEl.disabled = false;
            }
        });
    }

    // Search page: load courses + tutors from API
    if (currentFromPath === 'search') {
        const subjectSelect = document.getElementById('search-subject');
        const grid = document.getElementById('tutor-grid');
        const loadingEl = document.getElementById('search-loading');
        const emptyEl = document.getElementById('search-empty');

        async function loadSearch() {
            loadingEl && (loadingEl.style.display = 'block');
            emptyEl && (emptyEl.style.display = 'none');
            grid && (grid.innerHTML = '');

            try {
                const [coursesRes, tutorsRes] = await Promise.all([
                    apiRequest('/courses', { auth: false }),
                    apiRequest('/tutors' + (subjectSelect?.value ? '?subject=' + encodeURIComponent(subjectSelect.value) : ''), { auth: false }),
                ]);

                if (subjectSelect && coursesRes.courses) {
                    subjectSelect.innerHTML = '<option value="">All Subjects</option>' +
                        coursesRes.courses.map(c => `<option value="${c.slug}">${c.name}</option>`).join('');
                    if (subjectSelect.value) subjectSelect.value = subjectSelect.value;
                }

                const tutors = tutorsRes.tutors || [];
                window.__tutorlyTutors = tutors;
                if (tutors.length === 0) {
                    emptyEl && (emptyEl.style.display = 'block');
                } else if (grid) {
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
                }
            } catch (err) {
                emptyEl && (emptyEl.textContent = 'Could not load tutors. Is the API running?') && (emptyEl.style.display = 'block');
            } finally {
                loadingEl && (loadingEl.style.display = 'none');
            }
        }

        loadSearch();
        document.getElementById('search-btn')?.addEventListener('click', loadSearch);
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
                    <p style="color:#64748b;margin-bottom:25px"><i class="fas fa-calendar-alt" style="color:#6366f1"></i> <strong>Next available:</strong> Various slots — book to confirm</p>
                </div>
            `;
            container.querySelector('[data-navigate="booking"]')?.addEventListener('click', () => {
                if (isAllowed('booking')) navigateTo('booking');
            });
        }
    }

    // Booking page: show selected tutor in summary
    if (currentFromPath === 'booking') {
        const summary = document.getElementById('booking-tutor-summary');
        const summaryRate = document.getElementById('booking-rate');
        const summaryTotal = document.getElementById('booking-total');
        const { selectedTutor } = getFlowState();
        if (summary && selectedTutor) {
            const initials = (selectedTutor.fullName || 'T').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
            const rate = selectedTutor.hourlyRate || 0;
            const fee = Math.round(rate * 0.1 * 100) / 100;
            const total = rate + fee;
            summary.innerHTML = `
                <div class="tutor-avatar" style="width:50px;height:50px;font-size:18px">${initials}</div>
                <div style="margin-left:15px">
                    <h4 style="color:#1e293b">${selectedTutor.fullName || 'Tutor'}</h4>
                    <div style="color:#64748b;font-size:14px">${(selectedTutor.subjects || []).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ') || 'Tutor'}</div>
                </div>
            `;
            if (summaryRate) summaryRate.textContent = '$' + rate + '/hour';
            if (summaryTotal) summaryTotal.textContent = '$' + total.toFixed(2);
            const feeEl = document.getElementById('booking-fee');
            const subtotalEl = document.getElementById('booking-subtotal');
            if (feeEl) feeEl.textContent = '$' + fee.toFixed(2);
            if (subtotalEl) subtotalEl.textContent = '$' + rate.toFixed(2);
        }
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
                    if (statUpcoming) statUpcoming.textContent = stats?.upcomingCount ?? bookings.length;
                    if (statRating) statRating.textContent = (tutor.averageRating ?? 0) > 0 ? (tutor.averageRating || 0).toFixed(1) : '—';
                    if (statRate) statRate.textContent = (stats?.bookingRate ?? 0) > 0 ? (stats.bookingRate + '%') : '—';

                    if (bookings.length === 0) {
                        sessionsList.innerHTML = '<p class="search-empty">No upcoming sessions</p>';
                    } else {
                        sessionsList.innerHTML = bookings.map(b => {
                            const start = new Date(b.startAt);
                            const end = new Date(start.getTime() + (b.durationMinutes || 60) * 60000);
                            const timeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + ' - ' + end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                            const dateStr = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                            const statusColor = b.status === 'confirmed' ? '#10b981' : b.status === 'pending' ? '#f59e0b' : '#64748b';
                            return `<div class="session-item">
                                <div><div style="font-weight:600">${b.studentName || 'Student'}</div><div style="color:#6b7280;font-size:14px">${b.subject || 'Session'}</div></div>
                                <div><div style="font-weight:600">${dateStr} • ${timeStr}</div><div style="color:${statusColor};font-size:14px"><i class="fas fa-circle" style="font-size:8px"></i> ${(b.status || 'confirmed').charAt(0).toUpperCase() + (b.status || '').slice(1)}</div></div>
                                <button class="nav-btn" style="background:#f1f5f9;color:#0ea5e9" disabled><i class="fas fa-video"></i> Join</button>
                            </div>`;
                        }).join('');
                    }

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