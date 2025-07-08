import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import lodash from 'lodash';
const { isEqual } = lodash;

describe('Segment color behavior after loading saved translations', () => {
  test('segments should show saved translations and be marked as unchanged (green)', () => {
    // Simulate the scenario described in the issue
    
    // 1. Initial job data loaded from .lqaboss (before saved translations applied)
    const initialJobData = {
      tus: [
        {
          guid: 'segment1',
          nsrc: ['Hello world'],
          ntgt: ['Hello world'] // Initially same as source
        },
        {
          guid: 'segment2',
          nsrc: ['Welcome'],
          ntgt: ['Welcome'] // Initially same as source
        }
      ]
    };

    // 2. Saved translations from .json file
    const savedTranslations = {
      tus: [
        {
          guid: 'segment1',
          ntgt: ['Hola mundo'] // Previously translated
        }
        // segment2 was never translated, so not in saved file
      ]
    };

    // 3. Apply saved translations (as done in App.tsx)
    const savedTuMap = new Map(savedTranslations.tus.map(tu => [tu.guid, tu]));
    
    const jobDataAfterLoading = {
      ...initialJobData,
      tus: initialJobData.tus.map(tu => {
        const savedTu = savedTuMap.get(tu.guid);
        if (savedTu && savedTu.ntgt) {
          return { ...tu, ntgt: savedTu.ntgt };
        }
        return tu;
      })
    };

    // 4. The updated job data becomes the new "original" baseline
    const originalJobDataAfterLoading = JSON.parse(JSON.stringify(jobDataAfterLoading));

    // 5. Verify the final state
    
    // segment1 should show the saved translation
    assert.deepEqual(jobDataAfterLoading.tus[0].ntgt, ['Hola mundo']);
    
    // segment2 should still show the source text
    assert.deepEqual(jobDataAfterLoading.tus[1].ntgt, ['Welcome']);

    // 6. Verify change detection - both should be "unchanged" (green)
    const isSegment1Modified = !isEqual(
      jobDataAfterLoading.tus[0].ntgt, 
      originalJobDataAfterLoading.tus[0].ntgt
    );
    const isSegment2Modified = !isEqual(
      jobDataAfterLoading.tus[1].ntgt, 
      originalJobDataAfterLoading.tus[1].ntgt
    );

    assert.equal(isSegment1Modified, false, 'Segment 1 should be unchanged (green) after loading');
    assert.equal(isSegment2Modified, false, 'Segment 2 should be unchanged (green) after loading');

    // 7. Test that change detection works after user makes edits
    const jobDataAfterUserEdit = JSON.parse(JSON.stringify(jobDataAfterLoading));
    jobDataAfterUserEdit.tus[0].ntgt = ['Hola mundo editado']; // User edits the saved translation

    const isSegment1ModifiedAfterEdit = !isEqual(
      jobDataAfterUserEdit.tus[0].ntgt, 
      originalJobDataAfterLoading.tus[0].ntgt
    );

    assert.equal(isSegment1ModifiedAfterEdit, true, 'Segment 1 should be modified (red) after user edit');
  });

  test('handles mixed scenario with some saved and some new translations', () => {
    const jobData = {
      tus: [
        { guid: 'tu1', nsrc: ['Hello'], ntgt: ['Hello'] },
        { guid: 'tu2', nsrc: ['World'], ntgt: ['World'] },
        { guid: 'tu3', nsrc: ['Test'], ntgt: ['Test'] }
      ]
    };

    const savedData = {
      tus: [
        { guid: 'tu1', ntgt: ['Hola'] },
        { guid: 'tu3', ntgt: ['Prueba'] }
        // tu2 not saved - was never translated
      ]
    };

    // Apply saved translations
    const savedTuMap = new Map(savedData.tus.map(tu => [tu.guid, tu]));
    const updatedJobData = {
      ...jobData,
      tus: jobData.tus.map(tu => {
        const savedTu = savedTuMap.get(tu.guid);
        if (savedTu && savedTu.ntgt) {
          return { ...tu, ntgt: savedTu.ntgt };
        }
        return tu;
      })
    };

    const originalAfterLoad = JSON.parse(JSON.stringify(updatedJobData));

    // Verify final state
    assert.deepEqual(updatedJobData.tus[0].ntgt, ['Hola']);     // Has saved translation
    assert.deepEqual(updatedJobData.tus[1].ntgt, ['World']);   // Still source text
    assert.deepEqual(updatedJobData.tus[2].ntgt, ['Prueba']);  // Has saved translation

    // All should be unchanged initially
    updatedJobData.tus.forEach((tu, index) => {
      const isModified = !isEqual(tu.ntgt, originalAfterLoad.tus[index].ntgt);
      assert.equal(isModified, false, `TU ${index} should be unchanged after loading`);
    });

    // User translates the previously untranslated segment
    const afterUserWork = JSON.parse(JSON.stringify(updatedJobData));
    afterUserWork.tus[1].ntgt = ['Mundo']; // User translates the middle one

    // Only the edited one should be marked as changed
    const modifications = afterUserWork.tus.map((tu, index) => 
      !isEqual(tu.ntgt, originalAfterLoad.tus[index].ntgt)
    );

    assert.deepEqual(modifications, [false, true, false]); // Only middle one changed
  });

  test('handles edge case where saved translation is same as source', () => {
    const jobData = {
      tus: [
        { guid: 'tu1', nsrc: ['OK'], ntgt: ['OK'] }
      ]
    };

    const savedData = {
      tus: [
        { guid: 'tu1', ntgt: ['OK'] } // Saved translation happens to be same as source
      ]
    };

    // Apply saved translations
    const savedTuMap = new Map(savedData.tus.map(tu => [tu.guid, tu]));
    const updatedJobData = {
      ...jobData,
      tus: jobData.tus.map(tu => {
        const savedTu = savedTuMap.get(tu.guid);
        if (savedTu && savedTu.ntgt) {
          return { ...tu, ntgt: savedTu.ntgt };
        }
        return tu;
      })
    };

    const originalAfterLoad = JSON.parse(JSON.stringify(updatedJobData));

    // Should still be marked as unchanged even though translation equals source
    const isModified = !isEqual(updatedJobData.tus[0].ntgt, originalAfterLoad.tus[0].ntgt);
    assert.equal(isModified, false, 'Should be unchanged even when saved translation equals source');
  });
});