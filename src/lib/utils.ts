import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatChromosomeName(chromosome: string): string {
  if (chromosome === 'X') return 'X';
  if (chromosome === 'Y') return 'Y';
  if (chromosome === 'MT') return 'Mitochondrial';
  
  const num = parseInt(chromosome, 10);
  if (isNaN(num)) return chromosome;
  
  return `Chromosome ${num}`;
}

export function generateRandomId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
