// Test setup and utilities
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

// Create downloads directory for UI tests if it doesn't exist
try {
  await mkdir(join(process.cwd(), 'tests', 'downloads'), { recursive: true });
} catch (error) {
  // Directory might already exist, ignore error
}

// Global test configuration
export const testConfig = {
  timeout: 30000, // 30 seconds timeout for tests
  viewport: {
    width: 1280,
    height: 720
  },
  puppeteerOptions: {
    headless: process.env.CI !== undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage', // Overcome limited resource problems
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  }
};

// Helper function to wait for condition
export const waitForCondition = async (condition, timeout = 5000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return false;
};

// Helper to clean up puppeteer resources
export const cleanupPuppeteer = async (browser, page) => {
  try {
    if (page && !page.isClosed()) {
      await page.close();
    }
  } catch (error) {
    console.warn('Error closing page:', error);
  }
  
  try {
    if (browser) {
      await browser.close();
    }
  } catch (error) {
    console.warn('Error closing browser:', error);
  }
};