// Switch tabs logic
function switchTab(tabName, el) {
  // 1. Hide all screens
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  // 2. Remove active class from all tabs
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  
  // 3. Show selected screen & tab
  document.getElementById(`screen-${tabName}`).classList.add('active');
  el.classList.add('active');
  
  // Optional: Trigger haptic feedback if running on device
  if (window.Capacitor && window.Capacitor.Plugins.Haptics) {
    window.Capacitor.Plugins.Haptics.impact({ style: 'LIGHT' });
  }
}

// Simulate loading state for the Spinner
function showLoading(screenId) {
  const overlay = document.getElementById('loading-overlay');
  overlay.classList.remove('hidden');
  
  // Fake network request (2 seconds)
  setTimeout(() => {
    overlay.classList.add('hidden');
    alert("Action Complete!"); // Placeholder
  }, 2000);
}