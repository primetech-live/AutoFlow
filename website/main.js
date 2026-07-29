document.addEventListener('DOMContentLoaded', () => {
  // 1. FAQ Accordion Logic
  const faqItems = document.querySelectorAll('.faq-item');
  
  faqItems.forEach(item => {
    const button = item.querySelector('.faq-question');
    button.addEventListener('click', () => {
      // Toggle current item
      const isOpen = item.classList.contains('open');
      
      // Optional: Close others
      // faqItems.forEach(otherItem => otherItem.classList.remove('open'));
      
      if (!isOpen) {
        item.classList.add('open');
      } else {
        item.classList.remove('open');
      }
    });
  });

  // 2. Copy to Clipboard for CLI section
  const copyBtn = document.querySelector('.copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const commandText = 'npm install -g autoflow-cli';
      navigator.clipboard.writeText(commandText).then(() => {
        // Visual feedback
        const originalHTML = copyBtn.innerHTML;
        copyBtn.innerHTML = '<span class="text-signal" style="font-size:12px;font-family:var(--f-mono)">Copied!</span>';
        setTimeout(() => {
          copyBtn.innerHTML = originalHTML;
        }, 2000);
      });
    });
  }

  // 3. Simple Deploy Sequence Strip Animation Orchestration
  const sequenceStages = document.querySelectorAll('.sequence-stage');
  
  if (sequenceStages.length > 0) {
    let currentStageIndex = 0;
    let timeoutId = null;
    
    // Inject Blue Line and Rocket into every stage
    sequenceStages.forEach((stage) => {
      const line = document.createElement('div');
      line.className = 'blue-line';
      const rocket = document.createElement('div');
      rocket.className = 'rocket-icon';
      rocket.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path></svg>';
      line.appendChild(rocket);
      stage.appendChild(line);
    });
    
    const track = document.querySelector('.sequence-track');
    
    const processNextStage = () => {
      if (currentStageIndex > 0) {
        sequenceStages[currentStageIndex - 1].classList.add('passed');
      }
      sequenceStages[currentStageIndex].classList.add('done');
      currentStageIndex++;
      
      if (currentStageIndex < sequenceStages.length) {
        timeoutId = setTimeout(processNextStage, 1000);
      } else {
        timeoutId = setTimeout(() => {
          track.classList.add('fade-out');
          
          setTimeout(() => {
            sequenceStages.forEach(s => {
              s.classList.remove('done');
              s.classList.remove('passed');
            });
            currentStageIndex = 0;
            track.classList.remove('fade-out');
            
            setTimeout(() => {
              timeoutId = setTimeout(processNextStage, 0);
            }, 800);
          }, 800);
        }, 3000);
      }
    };
    
    timeoutId = setTimeout(processNextStage, 500);
    
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        clearTimeout(timeoutId);
        if (track) track.classList.remove('fade-out');
        sequenceStages.forEach(s => {
          s.classList.remove('done');
          s.classList.remove('passed');
        });
        currentStageIndex = 0;
        timeoutId = setTimeout(processNextStage, 500);
      }
    });
  }
  
  // 4. Hero Terminal Typwriter Effect
  // Already has static text for structural reasons, but we can animate the cursor or do more if desired.
  // Kept static mostly based on instructions, but CSS handles cursor blink.
  

  // Scroll to top button logic
  const scrollToTopBtn = document.querySelector('.scroll-to-top');
  if (scrollToTopBtn) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 300) {
        scrollToTopBtn.style.display = 'flex';
        scrollToTopBtn.style.opacity = '1';
      } else {
        scrollToTopBtn.style.opacity = '0';
        setTimeout(() => { if (window.scrollY <= 300) scrollToTopBtn.style.display = 'none'; }, 200);
      }
    });

    scrollToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // 5. OS Detection & Direct GitHub Release Download Links
  const REPO_OWNER = 'primetech-live';
  const REPO_NAME = 'Autoflow-Release';
  const RELEASE_TAG = '1.1.2';
  const RELEASE_BASE = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${RELEASE_TAG}`;

  function getOsReleaseAsset() {
    const userAgent = navigator.userAgent.toLowerCase();
    const platform = navigator.platform ? navigator.platform.toLowerCase() : '';

    if (userAgent.includes('win') || platform.includes('win')) {
      return {
        url: `${RELEASE_BASE}/Autoflow-vNext.Setup.${RELEASE_TAG}.exe`,
        label: 'Download for Windows (.exe)',
        badge: 'Windows (x64)'
      };
    } else if (userAgent.includes('mac') || platform.includes('mac')) {
      return {
        url: `${RELEASE_BASE}/Autoflow-vNext-${RELEASE_TAG}.dmg`,
        label: 'Download for macOS (.dmg)',
        badge: 'macOS (Universal / arm64)'
      };
    } else if (userAgent.includes('linux') || platform.includes('linux')) {
      return {
        url: `${RELEASE_BASE}/Autoflow-vNext-${RELEASE_TAG}.AppImage`,
        label: 'Download for Linux (.AppImage)',
        badge: 'Linux (x64)'
      };
    }

    // Default fallback
    return {
      url: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/tag/${RELEASE_TAG}`,
      label: 'Download Latest Release',
      badge: 'Windows, macOS, Linux'
    };
  }

  const osAsset = getOsReleaseAsset();
  const downloadBtns = document.querySelectorAll('.js-download-btn, a[href="#install"], a[href="#"]');

  downloadBtns.forEach(btn => {
    if (btn.classList.contains('js-download-btn') || btn.textContent.trim().toLowerCase().includes('download') || btn.getAttribute('href') === '#install') {
      btn.href = osAsset.url;
      btn.setAttribute('target', '_blank');
      btn.setAttribute('rel', 'noopener noreferrer');
      
      if (btn.classList.contains('js-download-label')) {
        btn.textContent = osAsset.label;
      }
    }
  });

  // Display OS badge if element exists
  const osBadgeEl = document.querySelector('.js-os-badge');
  if (osBadgeEl) {
    osBadgeEl.textContent = `Auto-detected: ${osAsset.badge}`;
  }
});

