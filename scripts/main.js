/**
 * Tutorly Demo - Main JavaScript File
 * Handles screen navigation, UI interactions, and dynamic updates
 */

// ===== NAVIGATION SYSTEM =====
// Screen order for navigation buttons
const SCREEN_ORDER = ['onboarding', 'search', 'profile', 'booking', 'dashboard'];

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
                showScreen(screenId);
            }
        });
    });
    
    // Data-navigate attributes (for buttons that navigate to another screen)
    document.querySelectorAll('[data-navigate]').forEach(element => {
        element.addEventListener('click', (e) => {
            const targetScreen = element.getAttribute('data-navigate');
            if (targetScreen) {
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
    console.log('Tutorly Demo initialized');
    
    // Initialize all event listeners
    initializeEventListeners();
    
    // Restore last viewed screen or show onboarding
    restoreLastScreen();
    
    // Update booking summary
    updateBookingSummary();
    
    // Handle responsive design
    handleResponsive();
    
    // Setup smooth scrolling
    setupSmoothScrolling();
    
    // Add UI enhancements
    setupUIEnhancements();
    
    // Add keyboard navigation (optional)
    document.addEventListener('keydown', (e) => {
        // Left/right arrow keys for navigation between screens
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            const currentScreen = document.querySelector('.screen.active')?.id;
            if (currentScreen) {
                const currentIndex = SCREEN_ORDER.indexOf(currentScreen);
                let newIndex;
                
                if (e.key === 'ArrowLeft' && currentIndex > 0) {
                    newIndex = currentIndex - 1;
                } else if (e.key === 'ArrowRight' && currentIndex < SCREEN_ORDER.length - 1) {
                    newIndex = currentIndex + 1;
                }
                
                if (newIndex !== undefined) {
                    showScreen(SCREEN_ORDER[newIndex]);
                }
            }
        }
    });
});

// ===== EXPORT FOR MODULE USE (if needed in future) =====
// If using modules, uncomment below:
// export { showScreen, selectTimeSlot };