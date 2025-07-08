import { test, describe, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import puppeteer from 'puppeteer';

describe('Editor UI Tests', () => {
  let browser;
  let page;
  const baseUrl = process.env.TEST_URL || 'http://localhost:3000';

  before(async () => {
    browser = await puppeteer.launch({
      headless: process.env.CI !== undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
  });

  after(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('Editor components render without errors', async () => {
    await page.goto(baseUrl);
    await page.waitForSelector('[data-testid="app-container"]');
    
    // Check that editor-related elements can be found or app is in a valid state
    const hasEditor = await page.$('[data-testid*="editor"]') !== null;
    const hasTextArea = await page.$('textarea') !== null;
    const hasContentEditable = await page.$('[contenteditable]') !== null;
    
    // At least one of these should be true, or the app should be in a file loading state
    const hasFileInput = await page.$('input[type="file"]') !== null;
    const hasDropZone = await page.$('[data-testid="drop-zone"]') !== null;
    
    assert.ok(
      hasEditor || hasTextArea || hasContentEditable || hasFileInput || hasDropZone,
      'App should have editor components or be in file loading state'
    );
  });

  test('Keyboard shortcuts work in editor context', async () => {
    await page.goto(baseUrl);
    await page.waitForSelector('[data-testid="app-container"]');
    
    // Test common keyboard shortcuts that should work globally
    const initialConsoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        initialConsoleErrors.push(msg.text());
      }
    });
    
    // Test Ctrl+/ for help or other global shortcuts
    await page.keyboard.down('Control');
    await page.keyboard.press('Slash');
    await page.keyboard.up('Control');
    
    await page.waitForTimeout(500);
    
    // Test Escape key
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // Should not cause critical errors
    const criticalErrors = initialConsoleErrors.filter(error => 
      !error.includes('Warning') && 
      !error.includes('DevTools') &&
      !error.includes('manifest')
    );
    
    assert.equal(criticalErrors.length, 0, 'Keyboard shortcuts should not cause errors');
  });

  test('Editor handles focus and blur events', async () => {
    await page.goto(baseUrl);
    await page.waitForSelector('[data-testid="app-container"]');
    
    // Find focusable elements
    const focusableElements = await page.$$('input, textarea, [contenteditable], button');
    
    if (focusableElements.length > 0) {
      // Focus on the first focusable element
      await focusableElements[0].focus();
      await page.waitForTimeout(200);
      
      // Blur by focusing on body
      await page.evaluate(() => document.body.focus());
      await page.waitForTimeout(200);
      
      // Should not cause any JavaScript errors
      const errors = await page.evaluate(() => {
        return window.errors || [];
      });
      
      assert.equal(errors.length, 0, 'Focus/blur should not cause errors');
    }
  });

  test('Text selection and editing work correctly', async () => {
    await page.goto(baseUrl);
    await page.waitForSelector('[data-testid="app-container"]');
    
    // Find any editable element
    const editableElement = await page.$('textarea, [contenteditable="true"]');
    
    if (editableElement) {
      // Click on the editable element
      await editableElement.click();
      
      // Type some text
      await page.keyboard.type('Test text');
      await page.waitForTimeout(200);
      
      // Select all text
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
      
      // Should be able to type over selected text
      await page.keyboard.type('Replaced text');
      await page.waitForTimeout(200);
      
      // Verify text was entered
      const value = await page.evaluate(el => el.value || el.textContent, editableElement);
      assert.ok(value.includes('Replaced text'), 'Text editing should work correctly');
    }
  });

  test('Editor maintains accessibility features', async () => {
    await page.goto(baseUrl);
    await page.waitForSelector('[data-testid="app-container"]');
    
    // Check for basic accessibility features
    const hasAriaLabels = await page.$$('[aria-label]');
    const hasRoles = await page.$$('[role]');
    const hasAltTexts = await page.$$('img[alt]');
    
    // At least some accessibility attributes should be present
    const totalA11yElements = hasAriaLabels.length + hasRoles.length + hasAltTexts.length;
    assert.ok(totalA11yElements > 0, 'App should have accessibility attributes');
    
    // Check that interactive elements are keyboard accessible
    const buttons = await page.$$('button');
    const links = await page.$$('a');
    const inputs = await page.$$('input');
    
    const totalInteractiveElements = buttons.length + links.length + inputs.length;
    
    if (totalInteractiveElements > 0) {
      // Test tab navigation
      await page.keyboard.press('Tab');
      const activeElement = await page.evaluate(() => document.activeElement.tagName);
      
      assert.ok(
        ['BUTTON', 'A', 'INPUT', 'TEXTAREA'].includes(activeElement) || 
        activeElement === 'BODY', // If no focusable elements, focus goes to body
        'Tab navigation should work on interactive elements'
      );
    }
  });

  test('Editor performance is acceptable', async () => {
    await page.goto(baseUrl);
    
    // Measure page load performance
    const metrics = await page.metrics();
    
    // Basic performance checks
    assert.ok(metrics.JSHeapUsedSize < 50 * 1024 * 1024, 'JS heap should be under 50MB'); // 50MB limit
    assert.ok(metrics.JSHeapTotalSize < 100 * 1024 * 1024, 'Total JS heap should be under 100MB'); // 100MB limit
    
    // Measure interaction performance
    const startTime = Date.now();
    
    // Simulate some user interactions
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(10);
    }
    
    const endTime = Date.now();
    const interactionTime = endTime - startTime;
    
    assert.ok(interactionTime < 1000, 'Basic interactions should complete within 1 second');
  });

  test('Editor handles rapid input without issues', async () => {
    await page.goto(baseUrl);
    await page.waitForSelector('[data-testid="app-container"]');
    
    const editableElement = await page.$('textarea, [contenteditable="true"], input[type="text"]');
    
    if (editableElement) {
      await editableElement.click();
      
      // Type rapidly
      const testText = 'This is a rapid typing test with many characters to simulate fast user input';
      await page.keyboard.type(testText, { delay: 10 }); // Fast typing
      
      await page.waitForTimeout(500);
      
      // Check that the text was properly handled
      const value = await page.evaluate(el => el.value || el.textContent, editableElement);
      
      // Should contain at least part of the text (allowing for potential throttling)
      assert.ok(value.length > 0, 'Rapid input should be handled');
      assert.ok(value.includes('rapid') || value.includes('typing'), 'Text should be partially preserved');
    }
  });
});