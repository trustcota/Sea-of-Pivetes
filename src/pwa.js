import { registerSW } from 'virtual:pwa-register';

// Register standard PWA service worker with auto-updates
if ('serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onRegistered(r) {
      console.log('SW registered successfully:', r);
    },
    onRegisterError(error) {
      console.error('SW registration error:', error);
    }
  });
}

// Check online/offline status
function updateOnlineStatus() {
  const offlineIndicator = document.getElementById('pwa-offline-indicator');
  if (offlineIndicator) {
    offlineIndicator.style.display = navigator.onLine ? 'none' : 'flex';
  }
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// Handle install prompt (beforeinstallprompt)
let deferredPrompt = null;
const installContainer = document.getElementById('pwa-install-container');
const installBtn = document.getElementById('pwa-install-btn');

// Detect standalone mode (already installed)
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                     (window.navigator.standalone === true);

if (!isStandalone) {
  // Detect iOS Safari
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(userAgent) && !/crios|fxios|opt|opios/.test(userAgent);

  if (isIOS) {
    // Show iOS install button option
    if (installContainer) {
      installContainer.style.display = 'block';
    }
    if (installBtn) {
      installBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Instalar no iOS
      `;
      installBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const modal = document.getElementById('pwa-ios-modal');
        if (modal) modal.style.display = 'flex';
      });
    }
  } else {
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent standard browser dialogue
      e.preventDefault();
      // Stash the event so it can be triggered later.
      deferredPrompt = e;
      // Update UI notify the user they can install the PWA
      if (installContainer) {
        installContainer.style.display = 'block';
      }
    });
  }
}

if (installBtn && !isStandalone) {
  installBtn.addEventListener('click', async () => {
    // If iOS, the click is handled separately
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent) && !/crios|fxios|opt|opios/.test(userAgent);
    if (isIOS) return;

    if (!deferredPrompt) return;
    // Show the prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    if (outcome === 'accepted') {
      if (installContainer) {
        installContainer.style.display = 'none';
      }
    }
    deferredPrompt = null;
  });
}

// Handle closing the iOS Modal
const iosCloseBtn = document.getElementById('pwa-ios-close');
if (iosCloseBtn) {
  iosCloseBtn.addEventListener('click', () => {
    const modal = document.getElementById('pwa-ios-modal');
    if (modal) modal.style.display = 'none';
  });
}

// Hide install panel on successful installation
window.addEventListener('appinstalled', () => {
  console.log('Mar de Pivetes was installed successfully!');
  if (installContainer) {
    installContainer.style.display = 'none';
  }
});
