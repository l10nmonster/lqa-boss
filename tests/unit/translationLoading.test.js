import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

describe('Translation loading functionality', () => {
  test('applies saved translations to job data correctly', () => {
    // Mock job data from .lqaboss file
    const originalJobData = {
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
        },
        {
          guid: 'tu3',
          nsrc: ['Test'],
          ntgt: ['Test'] // Initially same as source
        }
      ]
    };

    // Mock saved translations from .json file
    const savedJobData = {
      tus: [
        {
          guid: 'tu1',
          ntgt: ['Hola'] // Translated
        },
        {
          guid: 'tu2',
          ntgt: ['Mundo'] // Translated
        }
        // tu3 not in saved data - should remain unchanged
      ]
    };

    // Simulate the translation application logic from App.tsx
    const savedTuMap = new Map(savedJobData.tus.map(tu => [tu.guid, tu]));
    
    const updatedTus = originalJobData.tus.map(tu => {
      const savedTu = savedTuMap.get(tu.guid);
      if (savedTu && savedTu.ntgt) {
        return { ...tu, ntgt: savedTu.ntgt };
      }
      return tu;
    });

    const updatedJobData = { ...originalJobData, tus: updatedTus };

    // Verify translations were applied correctly
    assert.deepEqual(updatedJobData.tus[0].ntgt, ['Hola']);
    assert.deepEqual(updatedJobData.tus[1].ntgt, ['Mundo']);
    assert.deepEqual(updatedJobData.tus[2].ntgt, ['Test']); // Unchanged

    // Verify other properties remain intact
    assert.deepEqual(updatedJobData.tus[0].nsrc, ['Hello']);
    assert.deepEqual(updatedJobData.tus[0].guid, 'tu1');
  });

  test('handles complex normalized text arrays', () => {
    const originalJobData = {
      tus: [
        {
          guid: 'tu1',
          nsrc: ['Click ', { t: 'bx', v: '<a>' }, 'here', { t: 'ex', v: '</a>' }],
          ntgt: ['Click ', { t: 'bx', v: '<a>' }, 'here', { t: 'ex', v: '</a>' }]
        }
      ]
    };

    const savedJobData = {
      tus: [
        {
          guid: 'tu1',
          ntgt: ['Haga clic ', { t: 'bx', v: '<a>' }, 'aquí', { t: 'ex', v: '</a>' }]
        }
      ]
    };

    const savedTuMap = new Map(savedJobData.tus.map(tu => [tu.guid, tu]));
    
    const updatedTus = originalJobData.tus.map(tu => {
      const savedTu = savedTuMap.get(tu.guid);
      if (savedTu && savedTu.ntgt) {
        return { ...tu, ntgt: savedTu.ntgt };
      }
      return tu;
    });

    const updatedJobData = { ...originalJobData, tus: updatedTus };

    // Verify complex translation was applied
    assert.deepEqual(updatedJobData.tus[0].ntgt, [
      'Haga clic ',
      { t: 'bx', v: '<a>' },
      'aquí',
      { t: 'ex', v: '</a>' }
    ]);
  });

  test('handles missing or invalid saved data gracefully', () => {
    const originalJobData = {
      tus: [
        {
          guid: 'tu1',
          nsrc: ['Hello'],
          ntgt: ['Hello']
        }
      ]
    };

    // Test with empty saved data
    const emptySavedData = { tus: [] };
    let savedTuMap = new Map(emptySavedData.tus.map(tu => [tu.guid, tu]));
    
    let updatedTus = originalJobData.tus.map(tu => {
      const savedTu = savedTuMap.get(tu.guid);
      if (savedTu && savedTu.ntgt) {
        return { ...tu, ntgt: savedTu.ntgt };
      }
      return tu;
    });

    assert.deepEqual(updatedTus[0].ntgt, ['Hello']); // Should remain unchanged

    // Test with missing ntgt in saved data
    const invalidSavedData = {
      tus: [
        {
          guid: 'tu1'
          // Missing ntgt property
        }
      ]
    };

    savedTuMap = new Map(invalidSavedData.tus.map(tu => [tu.guid, tu]));
    
    updatedTus = originalJobData.tus.map(tu => {
      const savedTu = savedTuMap.get(tu.guid);
      if (savedTu && savedTu.ntgt) {
        return { ...tu, ntgt: savedTu.ntgt };
      }
      return tu;
    });

    assert.deepEqual(updatedTus[0].ntgt, ['Hello']); // Should remain unchanged
  });

  test('preserves original job structure and metadata', () => {
    const originalJobData = {
      instructions: 'Test instructions',
      someMetadata: 'important data',
      tus: [
        {
          guid: 'tu1',
          nsrc: ['Hello'],
          ntgt: ['Hello'],
          additionalField: 'preserve me'
        }
      ]
    };

    const savedJobData = {
      tus: [
        {
          guid: 'tu1',
          ntgt: ['Hola']
        }
      ]
    };

    const savedTuMap = new Map(savedJobData.tus.map(tu => [tu.guid, tu]));
    
    const updatedTus = originalJobData.tus.map(tu => {
      const savedTu = savedTuMap.get(tu.guid);
      if (savedTu && savedTu.ntgt) {
        return { ...tu, ntgt: savedTu.ntgt };
      }
      return tu;
    });

    const updatedJobData = { ...originalJobData, tus: updatedTus };

    // Verify translation was updated
    assert.deepEqual(updatedJobData.tus[0].ntgt, ['Hola']);
    
    // Verify other fields were preserved
    assert.equal(updatedJobData.instructions, 'Test instructions');
    assert.equal(updatedJobData.someMetadata, 'important data');
    assert.equal(updatedJobData.tus[0].additionalField, 'preserve me');
    assert.deepEqual(updatedJobData.tus[0].nsrc, ['Hello']);
  });
});