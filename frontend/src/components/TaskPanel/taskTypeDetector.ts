import type { TaskType } from '../../types/tasks';

const patterns: Record<TaskType, RegExp[]> = {
  validate_rows: [
    /validate|verify|check|double.?check|confirm/i,
    /correct|accurate|accuracy/i,
    /random.?sample|sample.*rows/i
  ],
  fill_missing: [
    /fill.*missing|missing.*values?|complete.*missing/i,
    /fill.*empty|empty.*cells?/i,
    /research.*missing|find.*missing/i
  ],
  column_test: [
    /test.*column|column.*test/i,
    /ensure.*values?.*between|range.*check/i,
    /validate.*column|column.*validation/i,
    /all.*values?.*must|should.*be/i
  ],
  transform: [
    /convert|transform|calculate/i,
    /new.*column|create.*column|add.*column/i,
    /unit.*conversion|change.*units?/i,
    /from.*to|ng.*ml.*to.*[µu]m/i
  ],
  research: [
    /research|look.*up|find.*information/i,
    /web.*search|search.*online/i,
    /gather.*data|collect.*information/i
  ],
  general: []
};

export function detectTaskType(prompt: string): TaskType {
  const lowerPrompt = prompt.toLowerCase();
  
  // Check each task type's patterns
  for (const [taskType, regexps] of Object.entries(patterns)) {
    if (taskType === 'general') continue;
    
    for (const regex of regexps) {
      if (regex.test(lowerPrompt)) {
        return taskType as TaskType;
      }
    }
  }
  
  // Additional heuristics
  if (lowerPrompt.includes('rows') && !lowerPrompt.includes('column')) {
    if (lowerPrompt.includes('fill') || lowerPrompt.includes('missing')) {
      return 'fill_missing';
    }
    return 'validate_rows';
  }
  
  if (lowerPrompt.includes('column') && !lowerPrompt.includes('row')) {
    if (lowerPrompt.includes('test') || lowerPrompt.includes('ensure')) {
      return 'column_test';
    }
    if (lowerPrompt.includes('convert') || lowerPrompt.includes('transform')) {
      return 'transform';
    }
  }
  
  return 'general';
}