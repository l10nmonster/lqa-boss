import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import lodash from 'lodash';
const { isEqual } = lodash;

describe('Translation loading integration tests', () => {
  test('change detection works correctly after loading saved translations', () => {
    // Step 1: Initial job data (as loaded from .lqaboss)
    const initialJobData = {
      tus: [
        {
          guid: 'tu1',
          nsrc: ['Hello'],
          ntgt: ['Hello'] // Initially same as source
        },
        {
          guid: 'tu2', 
          nsrc: ['World'],
          ntgt: ['World'] // Initially same as source
        }
      ]
    };

    // Step 2: Saved translations (as loaded from .json)
    const savedJobData = {
      tus: [
        {
          guid: 'tu1',
          ntgt: ['Hola'] // Previously translated
        }
        // tu2 not in saved data - was never translated
      ]
    };

    // Step 3: Apply saved translations (simulate the App.tsx logic)
    const savedTuMap = new Map(savedJobData.tus.map(tu => [tu.guid, tu]));
    
    const updatedTus = initialJobData.tus.map(tu => {
      const savedTu = savedTuMap.get(tu.guid);
      if (savedTu && savedTu.ntgt) {
        return { ...tu, ntgt: savedTu.ntgt };
      }
      return tu;
    });

    const jobDataAfterLoading = { ...initialJobData, tus: updatedTus };
    
    // Step 4: This becomes the new "original" state (baseline for change detection)
    const originalJobDataAfterLoading = JSON.parse(JSON.stringify(jobDataAfterLoading));

    // Step 5: Verify the state after loading
    assert.deepEqual(jobDataAfterLoading.tus[0].ntgt, ['Hola']); // Should show saved translation
    assert.deepEqual(jobDataAfterLoading.tus[1].ntgt, ['World']); // Should remain as source
    
    // Step 6: Verify change detection - no changes yet, so all should be "unchanged"
    const isFirstTuChanged = !isEqual(jobDataAfterLoading.tus[0].ntgt, originalJobDataAfterLoading.tus[0].ntgt);
    const isSecondTuChanged = !isEqual(jobDataAfterLoading.tus[1].ntgt, originalJobDataAfterLoading.tus[1].ntgt);
    
    assert.equal(isFirstTuChanged, false); // Should be unchanged (green)
    assert.equal(isSecondTuChanged, false); // Should be unchanged (green)

    // Step 7: User makes a new edit to the first TU
    const jobDataAfterEdit = JSON.parse(JSON.stringify(jobDataAfterLoading));
    jobDataAfterEdit.tus[0].ntgt = ['Hola editado']; // User edits the saved translation

    // Step 8: Verify change detection after edit
    const isFirstTuChangedAfterEdit = !isEqual(jobDataAfterEdit.tus[0].ntgt, originalJobDataAfterLoading.tus[0].ntgt);
    const isSecondTuChangedAfterEdit = !isEqual(jobDataAfterEdit.tus[1].ntgt, originalJobDataAfterLoading.tus[1].ntgt);
    
    assert.equal(isFirstTuChangedAfterEdit, true); // Should be changed (red)
    assert.equal(isSecondTuChangedAfterEdit, false); // Should still be unchanged (green)

    // Step 9: User translates the second TU for the first time
    jobDataAfterEdit.tus[1].ntgt = ['Mundo'];

    const isSecondTuChangedAfterTranslation = !isEqual(jobDataAfterEdit.tus[1].ntgt, originalJobDataAfterLoading.tus[1].ntgt);
    assert.equal(isSecondTuChangedAfterTranslation, true); // Should be changed (red)
  });

  test('handles complex scenarios with multiple loading cycles', () => {
    // Scenario: User loads job, makes changes, saves, then loads again
    
    // Initial state
    let jobData = {
      tus: [
        { guid: 'tu1', nsrc: ['Hello'], ntgt: ['Hello'] },
        { guid: 'tu2', nsrc: ['World'], ntgt: ['World'] }
      ]
    };

    // First session: user translates first TU
    jobData.tus[0].ntgt = ['Hola'];
    
    // Save creates this JSON file
    const firstSaveData = {
      tus: [
        { guid: 'tu1', ntgt: ['Hola'] }
      ]
    };

    // Second session: load job with saved translations
    jobData = {
      tus: [
        { guid: 'tu1', nsrc: ['Hello'], ntgt: ['Hello'] }, // Reset to source
        { guid: 'tu2', nsrc: ['World'], ntgt: ['World'] }  // Reset to source
      ]
    };

    // Apply first save
    let savedTuMap = new Map(firstSaveData.tus.map(tu => [tu.guid, tu]));
    jobData.tus = jobData.tus.map(tu => {
      const savedTu = savedTuMap.get(tu.guid);
      if (savedTu && savedTu.ntgt) {
        return { ...tu, ntgt: savedTu.ntgt };
      }
      return tu;
    });

    // Verify first TU was restored
    assert.deepEqual(jobData.tus[0].ntgt, ['Hola']);
    assert.deepEqual(jobData.tus[1].ntgt, ['World']);

    // User continues and translates second TU
    jobData.tus[1].ntgt = ['Mundo'];

    // Second save includes both translations
    const secondSaveData = {
      tus: [
        { guid: 'tu1', ntgt: ['Hola'] },
        { guid: 'tu2', ntgt: ['Mundo'] }
      ]
    };

    // Third session: load job with both saved translations
    jobData = {
      tus: [
        { guid: 'tu1', nsrc: ['Hello'], ntgt: ['Hello'] },
        { guid: 'tu2', nsrc: ['World'], ntgt: ['World'] }
      ]
    };

    // Apply second save
    savedTuMap = new Map(secondSaveData.tus.map(tu => [tu.guid, tu]));
    jobData.tus = jobData.tus.map(tu => {
      const savedTu = savedTuMap.get(tu.guid);
      if (savedTu && savedTu.ntgt) {
        return { ...tu, ntgt: savedTu.ntgt };
      }
      return tu;
    });

    // Verify both translations were restored
    assert.deepEqual(jobData.tus[0].ntgt, ['Hola']);
    assert.deepEqual(jobData.tus[1].ntgt, ['Mundo']);
  });

  test('preserves placeholders and complex structures in saved translations', () => {
    const jobData = {
      tus: [
        {
          guid: 'tu1',
          nsrc: ['Click ', { t: 'bx', v: '<a href="example.com">' }, 'here', { t: 'ex', v: '</a>' }],
          ntgt: ['Click ', { t: 'bx', v: '<a href="example.com">' }, 'here', { t: 'ex', v: '</a>' }]
        }
      ]
    };

    const savedData = {
      tus: [
        {
          guid: 'tu1',
          ntgt: ['Haga clic ', { t: 'bx', v: '<a href="example.com">' }, 'aquí', { t: 'ex', v: '</a>' }]
        }
      ]
    };

    const savedTuMap = new Map(savedData.tus.map(tu => [tu.guid, tu]));
    
    const updatedTus = jobData.tus.map(tu => {
      const savedTu = savedTuMap.get(tu.guid);
      if (savedTu && savedTu.ntgt) {
        return { ...tu, ntgt: savedTu.ntgt };
      }
      return tu;
    });

    // Verify complex structure was preserved
    assert.deepEqual(updatedTus[0].ntgt, [
      'Haga clic ',
      { t: 'bx', v: '<a href="example.com">' },
      'aquí',
      { t: 'ex', v: '</a>' }
    ]);

    // Verify the placeholders are exact matches
    assert.equal(updatedTus[0].ntgt[1].t, 'bx');
    assert.equal(updatedTus[0].ntgt[1].v, '<a href="example.com">');
    assert.equal(updatedTus[0].ntgt[3].t, 'ex');
    assert.equal(updatedTus[0].ntgt[3].v, '</a>');
  });
});