import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';

describe('IEBC Office Management E2E Tests', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  it('should load the main map page', async () => {
    await page.goto('/iebc-office');
    
    // Check if page loads
    await expect(page).toHaveTitle(/Nasaka IEBC/);
    
    // Check for map container
    await expect(page.locator('[data-testid="office-map"]')).toBeVisible();
    
    // Check for search input
    await expect(page.locator('input[placeholder*="search" i]')).toBeVisible();
  });

  it('should search for offices', async () => {
    await page.goto('/iebc-office');
    
    // Type in search
    await page.fill('input[placeholder*="search" i]', 'Nairobi');
    
    // Wait for search results
    await page.waitForTimeout(500);
    
    // Check if search results appear
    const searchResults = page.locator('[data-testid="search-result"]');
    await expect(searchResults.first()).toBeVisible();
  });

  it('should display office details', async () => {
    await page.goto('/iebc-office');
    
    // Click on an office marker (simulate)
    await page.click('[data-testid="office-marker-test-office-1"]');
    
    // Check if office details appear
    await expect(page.locator('[data-testid="office-details"]')).toBeVisible();
    await expect(page.locator('text=Westlands')).toBeVisible();
  });

  it('should allow user to confirm office accuracy', async () => {
    // Mock authentication
    await page.evaluate(() => {
      localStorage.setItem('supabase.auth.token', 'mock-token');
      localStorage.setItem('user', JSON.stringify({
        id: 'test-user-1',
        email: 'test@example.com'
      }));
    });
    
    await page.goto('/iebc-office');
    
    // Click on an office
    await page.click('[data-testid="office-marker-test-office-1"]');
    
    // Click confirm button
    await page.click('[data-testid="confirm-accuracy-btn"]');
    
    // Fill confirmation form
    await page.check('[data-testid="accurate-yes"]');
    await page.fill('[data-testid="confirmation-notes"]', 'Verified in person');
    await page.click('[data-testid="submit-confirmation"]');
    
    // Check success message
    await expect(page.locator('text=Confirmation submitted')).toBeVisible();
  });

  it('should allow contribution submission', async () => {
    // Mock authentication
    await page.evaluate(() => {
      localStorage.setItem('supabase.auth.token', 'mock-token');
      localStorage.setItem('user', JSON.stringify({
        id: 'test-user-1',
        email: 'test@example.com'
      }));
    });
    
    await page.goto('/iebc-office');
    
    // Click on an office
    await page.click('[data-testid="office-marker-test-office-1"]');
    
    // Click contribute button
    await page.click('[data-testid="contribute-btn"]');
    
    // Select contribution type
    await page.selectOption('[data-testid="contribution-type"]', 'location_update');
    
    // Fill form
    await page.fill('[data-testid="contribution-description"]', 'Office has moved to new location');
    await page.click('[data-testid="submit-contribution"]');
    
    // Check success message
    await expect(page.locator('text=Contribution submitted')).toBeVisible();
  });

  it('should handle geolocation', async () => {
    // Mock geolocation
    await page.context().grantPermissions(['geolocation']);
    await page.setGeolocation({ latitude: -1.2654, longitude: 36.7984 });
    
    await page.goto('/iebc-office');
    
    // Click location button
    await page.click('[data-testid="location-button"]');
    
    // Check if location is detected
    await expect(page.locator('[data-testid="location-detected"]')).toBeVisible();
  });

  it('should display nearby offices', async () => {
    // Mock geolocation
    await page.context().grantPermissions(['geolocation']);
    await page.setGeolocation({ latitude: -1.2654, longitude: 36.7984 });
    
    await page.goto('/iebc-office');
    
    // Click location button
    await page.click('[data-testid="location-button"]');
    
    // Wait for nearby offices to load
    await page.waitForTimeout(1000);
    
    // Check if nearby offices are displayed
    await expect(page.locator('[data-testid="nearby-offices"]')).toBeVisible();
  });

  it('should handle navigation to office detail page', async () => {
    await page.goto('/iebc-office');
    
    // Click on an office
    await page.click('[data-testid="office-marker-test-office-1"]');
    
    // Click view details
    await page.click('[data-testid="view-details-btn"]');
    
    // Check if navigated to detail page
    await expect(page).toHaveURL(/\/office\/test-office-1/);
    await expect(page.locator('h1')).toContainText('Office Details');
  });

  it('should display error message on API failure', async () => {
    // Mock API failure
    await page.route('/api/v1/offices', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Server error' })
      });
    });
    
    await page.goto('/iebc-office');
    
    // Check error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('text=Failed to load offices')).toBeVisible();
  });

  it('should work on mobile viewport', async () => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/iebc-office');
    
    // Check mobile-specific elements
    await expect(page.locator('[data-testid="mobile-menu-btn"]')).toBeVisible();
    
    // Test mobile search
    await page.click('[data-testid="mobile-menu-btn"]');
    await expect(page.locator('[data-testid="mobile-search"]')).toBeVisible();
  });

  it('should support keyboard navigation', async () => {
    await page.goto('/iebc-office');
    
    // Tab to search input
    await page.keyboard.press('Tab');
    await expect(page.locator('input[placeholder*="search" i]')).toBeFocused();
    
    // Type search query
    await page.keyboard.type('Nairobi');
    await page.keyboard.press('Enter');
    
    // Check if search is triggered
    await page.waitForTimeout(500);
    const searchResults = page.locator('[data-testid="search-result"]');
    await expect(searchResults.first()).toBeVisible();
  });
});
