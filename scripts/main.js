/**
 * Tutorly - Main JavaScript File
 * Handles navigation, UI interactions, and dynamic updates
 */

// ===== NAVIGATION SYSTEM =====
// Screen order for navigation buttons
const SCREEN_ORDER = ['onboarding', 'search', 'profile', 'booking', 'dashboard'];

const SCREEN_TO_PAGE = {
    onboarding: '/pages/onboarding.html',
    search: '/pages/search.html',
    profile: '/pages/profile.html',
    booking: '/pages/booking.html',
    dashboard: '/pages/dashboard.html',
};

const API_BASE_URL = 'http://localhost:8787';

function getAuth() {
    const token = sessionStorage.getItem('tutorly_token');
    const userRaw = sessionStorage.getItem('tutorly_user');
    const user = userRaw ? JSON.parse(userRaw) : null;
    return { token, user };
}

function setAuth({ token, user }) {
    sessionStorage.setItem('tutorly_token', token);
    sessionStorage.setItem('tutorly_user', JSON.stringify(user));
}

function clearAuth() {
    sessionStorage.removeItem('tutorly_token');
    sessionStorage.removeItem('tutorly_user');
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
    if (!match) return null;
    const page = match[1].toLowerCase();
    if (page === 'onboarding') return 'onboarding';
    if (page === 'search') return 'search';
    if (page === 'profile') return 'profile';
    if (page === 'booking') return 'booking';
    if (page === 'dashboard') return 'dashboard';
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

    // Always allow onboarding.
    if (screenId === 'onboarding') return true;

    // Must be authenticated for everything else.
    if (!token || !user) return false;

    // Role-based dashboard.
    if (screenId === 'dashboard') return true;

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
    if (isAllowed(currentScreen)) return;

    // If blocked, redirect to onboarding.
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
    
    // Tutor cards (already have data-navigate, but we can add extra animation)
    document.querySelectorAll('.tutor-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // The navigation is handled by data-navigate attribute
            // We just add a little visual feedback
            card.style.transform = 'scale(0.98)';
            setTimeout(() => {
                card.style.transform = '';
            }, 150);

            // Store minimal "selected tutor" state for the realistic flow.
            const name = card.querySelector('h3')?.textContent?.trim();
            const rate = card.querySelector('.tutor-price')?.textContent?.trim();
            if (name) {
                setSelectedTutor({ name, rate });
            }
        });
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
        const fullNameEl = document.getElementById('auth-full-name');
        const emailEl = document.getElementById('auth-email');
        const passwordEl = document.getElementById('auth-password');
        const roleEl = document.getElementById('auth-role');
        const submitEl = document.getElementById('auth-submit');
        const errorEl = document.getElementById('auth-error');

        let mode = 'register';
        const applyMode = () => {
            if (!modeRegisterBtn || !modeLoginBtn) return;
            if (mode === 'register') {
                modeRegisterBtn.style.background = 'white';
                modeRegisterBtn.style.color = '#4f46e5';
                modeLoginBtn.style.background = 'rgba(255,255,255,0.2)';
                modeLoginBtn.style.color = 'white';
                if (fullNameEl) fullNameEl.parentElement.style.display = '';
                if (roleEl) roleEl.parentElement.style.display = '';
                if (submitEl) submitEl.textContent = 'Create Account';
            } else {
                modeLoginBtn.style.background = 'white';
                modeLoginBtn.style.color = '#4f46e5';
                modeRegisterBtn.style.background = 'rgba(255,255,255,0.2)';
                modeRegisterBtn.style.color = 'white';
                if (fullNameEl) fullNameEl.parentElement.style.display = 'none';
                if (roleEl) roleEl.parentElement.style.display = 'none';
                if (submitEl) submitEl.textContent = 'Sign In';
            }
        };

        modeRegisterBtn?.addEventListener('click', () => { mode = 'register'; applyMode(); });
        modeLoginBtn?.addEventListener('click', () => { mode = 'login'; applyMode(); });
        applyMode();

        submitEl?.addEventListener('click', async () => {
            if (!emailEl || !passwordEl || !submitEl) return;
            errorEl && (errorEl.style.display = 'none');

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

                // Clear flow state on new auth.
                sessionStorage.removeItem('tutorly_selected_tutor');

                // Route based on role.
                if (result.user.role === 'tutor') {
                    navigateTo('dashboard');
                } else {
                    navigateTo('search');
                }
            } catch (err) {
                if (errorEl) {
                    errorEl.textContent = err?.message || 'Unable to continue';
                    errorEl.style.display = 'block';
                }
            } finally {
                submitEl.disabled = false;
            }
        });
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