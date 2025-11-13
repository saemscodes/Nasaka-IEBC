// src/hooks/usePullToRefresh.js
import { useEffect, useRef } from 'react';
import PullToRefresh from 'pulltorefreshjs';

/**
 * Custom hook for pull-to-refresh functionality
 * Designed to work with map-based interfaces
 * 
 * @param {Object} options - Configuration options
 * @param {Function} options.onRefresh - Callback when refresh is triggered
 * @param {Array<string>} options.excludeSelectors - CSS selectors to exclude from PTR
 * @param {boolean} options.enabled - Enable/disable PTR
 */
export const usePullToRefresh = ({
  onRefresh,
  excludeSelectors = [],
  enabled = true
}) => {
  const ptrInstance = useRef(null);
  const lastTouchStart = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    // Track touch start position globally
    const handleTouchStart = (e) => {
      lastTouchStart.current = e.touches ? e.touches[0] : null;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });

    // Check if point is inside excluded element
    const pointInExcludedZone = (x, y) => {
      for (const selector of excludeSelectors) {
        const element = document.querySelector(selector);
        if (!element) continue;
        
        const rect = element.getBoundingClientRect();
        if (
          x >= rect.left &&
          x <= rect.right &&
          y >= rect.top &&
          y <= rect.bottom
        ) {
          return true;
        }
      }
      return false;
    };

    // Initialize Pull-to-Refresh
    ptrInstance.current = PullToRefresh.init({
      mainElement: 'body',
      distMax: 80,
      distThreshold: 60,
      distReload: 50,
      distIgnore: 0,
      
      // Custom resistance function for iOS-like feel
      resistanceFunction: (t) => Math.min(1, t / 2.5),
      
      // Refresh handler
      onRefresh() {
        if (onRefresh) {
          return Promise.resolve(onRefresh());
        }
        return Promise.resolve(window.location.reload());
      },
      
      // Determine if PTR should trigger
      shouldPullToRefresh() {
        // Only allow at scroll top
        if (window.scrollY !== 0) {
          return false;
        }

        // Check if touch started in excluded zone
        const touch = lastTouchStart.current;
        if (touch && pointInExcludedZone(touch.clientX, touch.clientY)) {
          return false;
        }

        // Check if touch is on interactive elements
        if (touch) {
          const element = document.elementFromPoint(touch.clientX, touch.clientY);
          if (element) {
            // Don't trigger on buttons, inputs, or interactive elements
            if (element.closest('button, input, select, textarea, a, [role="button"]')) {
              return false;
            }
            
            // Don't trigger on panels
            if (element.closest('.office-list-panel, .layer-control-panel, .office-bottom-sheet')) {
              return false;
            }
          }
        }

        return true;
      },
      
      // Custom HTML for pull indicator
      getMarkup() {
        return `
          <div class="ptr__box">
            <div class="ptr__content">
              <svg class="ptr__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
              </svg>
              <span class="ptr__text">Pull to refresh</span>
            </div>
          </div>
        `;
      },
      
      getStyles() {
        return '';
      },
      
      // State change handlers for dynamic text
      onInit() {
        const textEl = document.querySelector('.ptr__text');
        if (textEl) textEl.textContent = 'Pull to refresh';
      },
      
      onRelease() {
        const textEl = document.querySelector('.ptr__text');
        const iconEl = document.querySelector('.ptr__icon');
        if (textEl) textEl.textContent = 'Release to refresh';
        if (iconEl) iconEl.style.transform = 'rotate(180deg)';
      },
      
      onRefreshing() {
        const boxEl = document.querySelector('.ptr__box');
        if (boxEl) {
          boxEl.innerHTML = `
            <div class="ptr__content">
              <div class="ptr__spinner"></div>
              <span class="ptr__text">Refreshing...</span>
            </div>
          `;
        }
      }
    });

    // Cleanup
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      if (ptrInstance.current) {
        PullToRefresh.destroyAll();
        ptrInstance.current = null;
      }
    };
  }, [enabled, onRefresh, excludeSelectors]);

  return ptrInstance;
};