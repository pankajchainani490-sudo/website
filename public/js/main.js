document.addEventListener('DOMContentLoaded', () => {
  // ==================== 1. Active Navigation Highlighting ====================
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.nav-link');
  
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (currentPath === href || (href !== '/' && currentPath.startsWith(href))) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
});
