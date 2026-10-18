import type {Course} from './data';

// Refresh the original defaults without rewriting saved course records.
const accents: Record<string, string> = {
  '#7a875e': '#35d07f', '#5f8195': '#f277c6', '#a47756': '#f4d85e',
  '#85719a': '#568af5', '#948346': '#b794f6',
};
export function courseAccent(course: Course): string {
  return accents[course.color.toLowerCase()] || course.color;
}
