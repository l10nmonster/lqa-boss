import { JobData } from '../types';
import { isEqual } from 'lodash';

/**
 * Finds and saves only the translation units that have been modified.
 * @param jobData - The current job data with potential changes.
 * @param originalJobData - The original, unmodified job data.
 * @param fileName - The base name for the output file.
 */
export const saveChangedTus = (
  jobData: JobData,
  originalJobData: JobData,
  fileName: string
) => {
  const originalTus = new Map(originalJobData.tus.map(tu => [tu.guid, tu]));
  
  const changedTus = jobData.tus.filter(currentTu => {
    const originalTu = originalTus.get(currentTu.guid);
    if (!originalTu) {
      // TU was added, should not happen in this context but good to handle
      return true;
    }
    return !isEqual(currentTu.ntgt, originalTu.ntgt);
  });

  const outputData: JobData = {
    ...jobData,
    tus: changedTus,
  };

  const jsonString = JSON.stringify(outputData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  
  const baseName = fileName.endsWith('.lqaboss') 
    ? fileName.slice(0, -'.lqaboss'.length) 
    : fileName;
  link.download = `${baseName}.json`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  alert(`${changedTus.length} changed segment(s) saved.`);
}; 