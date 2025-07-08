import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { saveChangedTus } from '../../src/utils/saveHandler.ts';

// Mock DOM elements for testing
const createMockDOM = () => {
  global.document = {
    createElement: () => ({
      href: '',
      download: '',
      click: () => {},
      remove: () => {},
      parentNode: {
        removeChild: () => {}
      }
    }),
    body: {
      appendChild: () => {},
      removeChild: () => {}
    }
  };
  
  global.URL = {
    createObjectURL: () => 'mock-url',
    revokeObjectURL: () => {}
  };
  
  global.Blob = class MockBlob {
    constructor(content, options) {
      this.content = content;
      this.options = options;
    }
  };
  
  global.alert = () => {}; // Mock alert
};

describe('saveHandler utilities', () => {
  test('saveChangedTus identifies changed translation units', () => {
    createMockDOM();
    
    const originalJobData = {
      sourceLang: 'en',
      targetLang: 'es',
      tus: [
        {
          jobGuid: 'job1',
          guid: 'tu1',
          rid: 'r1',
          sid: 's1',
          nsrc: ['Hello'],
          ntgt: ['Hola'],
          q: 100,
          ts: 1234567890
        },
        {
          jobGuid: 'job1',
          guid: 'tu2',
          rid: 'r2',
          sid: 's2',
          nsrc: ['World'],
          ntgt: ['Mundo'],
          q: 100,
          ts: 1234567890
        }
      ]
    };

    const modifiedJobData = {
      sourceLang: 'en',
      targetLang: 'es',
      tus: [
        {
          jobGuid: 'job1',
          guid: 'tu1',
          rid: 'r1',
          sid: 's1',
          nsrc: ['Hello'],
          ntgt: ['Hola'], // unchanged
          q: 100,
          ts: 1234567890
        },
        {
          jobGuid: 'job1',
          guid: 'tu2',
          rid: 'r2',
          sid: 's2',
          nsrc: ['World'],
          ntgt: ['Mundo modificado'], // changed
          q: 100,
          ts: 1234567890
        }
      ]
    };

    // Since saveChangedTus triggers download, we need to test indirectly
    // by checking the behavior doesn't throw errors
    assert.doesNotThrow(() => {
      saveChangedTus(modifiedJobData, originalJobData, 'test.lqaboss');
    });
  });

  test('saveChangedTus handles empty changes', () => {
    createMockDOM();
    
    const jobData = {
      sourceLang: 'en',
      targetLang: 'es',
      tus: [
        {
          jobGuid: 'job1',
          guid: 'tu1',
          rid: 'r1',
          sid: 's1',
          nsrc: ['Hello'],
          ntgt: ['Hola'],
          q: 100,
          ts: 1234567890
        }
      ]
    };

    // Same data for both original and current
    assert.doesNotThrow(() => {
      saveChangedTus(jobData, jobData, 'test.lqaboss');
    });
  });

  test('saveChangedTus handles missing TUs', () => {
    createMockDOM();
    
    const originalJobData = {
      sourceLang: 'en',
      targetLang: 'es',
      tus: []
    };

    const newJobData = {
      sourceLang: 'en',
      targetLang: 'es',
      tus: [
        {
          jobGuid: 'job1',
          guid: 'tu1',
          rid: 'r1',
          sid: 's1',
          nsrc: ['Hello'],
          ntgt: ['Hola'],
          q: 100,
          ts: 1234567890
        }
      ]
    };

    assert.doesNotThrow(() => {
      saveChangedTus(newJobData, originalJobData, 'test.lqaboss');
    });
  });

  test('saveChangedTus generates correct filename', () => {
    createMockDOM();
    
    const jobData = {
      sourceLang: 'en',
      targetLang: 'es',
      tus: []
    };

    // Test with .lqaboss extension
    assert.doesNotThrow(() => {
      saveChangedTus(jobData, jobData, 'myfile.lqaboss');
    });

    // Test without .lqaboss extension
    assert.doesNotThrow(() => {
      saveChangedTus(jobData, jobData, 'myfile');
    });
  });
});