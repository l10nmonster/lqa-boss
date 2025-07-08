import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import lodash from 'lodash';
const { isEqual } = lodash;

describe('Three-state visual system', () => {
  // Helper function that mirrors the getSegmentState logic from TextSegmentEditor
  const getSegmentState = (currentTu, originalTu, savedTu) => {
    if (!currentTu || !originalTu || !savedTu) return 'original';
    
    // Check if current matches original source text (green)
    if (isEqual(currentTu.ntgt, originalTu.ntgt)) {
      return 'original'; // Green - matches original source text
    }
    
    // Check if current matches saved translation (yellow)  
    if (isEqual(currentTu.ntgt, savedTu.ntgt)) {
      return 'saved'; // Yellow - matches saved translation
    }
    
    // Current differs from both original and saved
    return 'modified'; // Red - has unsaved changes
  };

  test('segments show correct states in three-state system', () => {
    // Setup: simulate the three data structures as created in App.tsx
    
    // 1. Original job data (green state - source text)
    const originalJobData = {
      tus: [
        { guid: 'tu1', nsrc: ['Hello'], ntgt: ['Hello'] },  // Source text as target
        { guid: 'tu2', nsrc: ['World'], ntgt: ['World'] },  // Source text as target
        { guid: 'tu3', nsrc: ['Test'], ntgt: ['Test'] }     // Source text as target
      ]
    };

    // 2. Saved job data (yellow state - saved translations)  
    const savedJobData = {
      tus: [
        { guid: 'tu1', nsrc: ['Hello'], ntgt: ['Hola'] },     // Has saved translation
        { guid: 'tu2', nsrc: ['World'], ntgt: ['World'] },   // No translation saved
        { guid: 'tu3', nsrc: ['Test'], ntgt: ['Prueba'] }    // Has saved translation
      ]
    };

    // 3. Current job data (starts same as saved, red when modified)
    let currentJobData = {
      tus: [
        { guid: 'tu1', nsrc: ['Hello'], ntgt: ['Hola'] },     // Currently matches saved
        { guid: 'tu2', nsrc: ['World'], ntgt: ['World'] },   // Currently matches saved (= original)
        { guid: 'tu3', nsrc: ['Test'], ntgt: ['Prueba'] }    // Currently matches saved
      ]
    };

    // Test initial states after loading
    assert.equal(
      getSegmentState(currentJobData.tus[0], originalJobData.tus[0], savedJobData.tus[0]),
      'saved',
      'TU1 should be SAVED (yellow) - has saved translation different from source'
    );

    assert.equal(
      getSegmentState(currentJobData.tus[1], originalJobData.tus[1], savedJobData.tus[1]),
      'original',
      'TU2 should be ORIGINAL (green) - saved translation same as source'
    );

    assert.equal(
      getSegmentState(currentJobData.tus[2], originalJobData.tus[2], savedJobData.tus[2]),
      'saved',
      'TU3 should be SAVED (yellow) - has saved translation different from source'
    );

    // Test after user modifies a saved translation
    currentJobData = JSON.parse(JSON.stringify(currentJobData));
    currentJobData.tus[0].ntgt = ['Hola editado']; // User edits the saved translation

    assert.equal(
      getSegmentState(currentJobData.tus[0], originalJobData.tus[0], savedJobData.tus[0]),
      'modified',
      'TU1 should be MODIFIED (red) after user edit'
    );

    // Test after user translates an untranslated segment
    currentJobData.tus[1].ntgt = ['Mundo']; // User translates for first time

    assert.equal(
      getSegmentState(currentJobData.tus[1], originalJobData.tus[1], savedJobData.tus[1]),
      'modified', 
      'TU2 should be MODIFIED (red) after user translation'
    );

    // TU3 should still be in saved state
    assert.equal(
      getSegmentState(currentJobData.tus[2], originalJobData.tus[2], savedJobData.tus[2]),
      'saved',
      'TU3 should still be SAVED (yellow) - unchanged'
    );
  });

  test('handles revert operations correctly', () => {
    // Setup
    const originalJobData = {
      tus: [{ guid: 'tu1', nsrc: ['Hello'], ntgt: ['Hello'] }]
    };

    const savedJobData = {
      tus: [{ guid: 'tu1', nsrc: ['Hello'], ntgt: ['Hola'] }]
    };

    // Start with saved translation
    let currentJobData = {
      tus: [{ guid: 'tu1', nsrc: ['Hello'], ntgt: ['Hola'] }]
    };

    // Should be in saved state
    assert.equal(
      getSegmentState(currentJobData.tus[0], originalJobData.tus[0], savedJobData.tus[0]),
      'saved'
    );

    // User modifies it
    currentJobData.tus[0].ntgt = ['Hola editado'];
    assert.equal(
      getSegmentState(currentJobData.tus[0], originalJobData.tus[0], savedJobData.tus[0]),
      'modified'
    );

    // User clicks "Undo" button (revert to saved)
    currentJobData.tus[0].ntgt = savedJobData.tus[0].ntgt;
    assert.equal(
      getSegmentState(currentJobData.tus[0], originalJobData.tus[0], savedJobData.tus[0]),
      'saved',
      'Should return to SAVED state after Undo'
    );

    // User clicks "Original" button (revert to source)
    currentJobData.tus[0].ntgt = originalJobData.tus[0].ntgt;
    assert.equal(
      getSegmentState(currentJobData.tus[0], originalJobData.tus[0], savedJobData.tus[0]),
      'original',
      'Should return to ORIGINAL state after Original button'
    );
  });

  test('handles edge case where saved translation equals source', () => {
    const originalJobData = {
      tus: [{ guid: 'tu1', nsrc: ['OK'], ntgt: ['OK'] }]
    };

    const savedJobData = {
      tus: [{ guid: 'tu1', nsrc: ['OK'], ntgt: ['OK'] }] // Saved same as source
    };

    const currentJobData = {
      tus: [{ guid: 'tu1', nsrc: ['OK'], ntgt: ['OK'] }]
    };

    // Should be original state since saved equals source
    assert.equal(
      getSegmentState(currentJobData.tus[0], originalJobData.tus[0], savedJobData.tus[0]),
      'original',
      'Should be ORIGINAL when saved translation equals source'
    );

    // If user changes it then reverts to saved, should still be original
    currentJobData.tus[0].ntgt = ['OK modified'];
    assert.equal(getSegmentState(currentJobData.tus[0], originalJobData.tus[0], savedJobData.tus[0]), 'modified');
    
    currentJobData.tus[0].ntgt = savedJobData.tus[0].ntgt; // Undo to saved
    assert.equal(
      getSegmentState(currentJobData.tus[0], originalJobData.tus[0], savedJobData.tus[0]),
      'original',
      'Should return to ORIGINAL after Undo when saved equals source'
    );
  });
});