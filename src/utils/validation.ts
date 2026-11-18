export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const SEQUENTIAL_PATTERNS = [
  '0123456789',
  '1234567890',
  '9876543210',
  '0987654321',
  '6789012345',
  '9012345678',
  '8901234567',
  '7890123456',
];

export function validateGenuineMobile(raw: string): ValidationResult {
  const mobile = raw.trim();

  if (!/^\d{10}$/.test(mobile)) {
    return { valid: false, error: 'Enter a valid 10-digit mobile number.' };
  }

  if (!/^[6-9]\d{9}$/.test(mobile)) {
    return { valid: false, error: 'Genuine mobile numbers must start with 6, 7, 8, or 9.' };
  }

  if (/(.)\1{2,}/.test(mobile)) {
    return {
      valid: false,
      error: 'Fake number rejected: 3 or more identical consecutive digits (e.g. 999, 111) are not allowed.',
    };
  }

  const uniqueDigits = new Set(mobile.split(''));
  if (uniqueDigits.size < 4) {
    return {
      valid: false,
      error: 'Please enter a genuine mobile number (repeated digit patterns are not allowed).',
    };
  }

  for (const seq of SEQUENTIAL_PATTERNS) {
    for (let i = 0; i <= seq.length - 6; i++) {
      if (mobile.includes(seq.slice(i, i + 6))) {
        return {
          valid: false,
          error: 'Sequential test numbers are not allowed. Enter your genuine mobile number.',
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Username must mix letters and numbers (e.g. rahul78).
 */
export function validateUsername(username: string): ValidationResult {
  const clean = username.trim();
  if (clean.length < 4 || clean.length > 20) {
    return { valid: false, error: 'Username must be between 4 and 20 characters.' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
    return { valid: false, error: 'Username can only contain letters, numbers, and underscores.' };
  }
  if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(clean)) {
    return {
      valid: false,
      error: 'Username must contain both letters and numbers (e.g. rahul78).',
    };
  }
  return { valid: true };
}

/**
 * Password must mix letters and numbers (min 6 chars, e.g. ad78pass).
 */
export function validateMixedPassword(password: string): ValidationResult {
  const clean = password.trim();
  if (clean.length < 6 || clean.length > 24) {
    return { valid: false, error: 'Password must be 6 to 24 characters.' };
  }
  if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(clean)) {
    return {
      valid: false,
      error: 'Password must mix both letters and numbers (e.g. rahul123).',
    };
  }
  return { valid: true };
}

export const MIN_DEPOSIT = 100;
export const MAX_DEPOSIT = 50000;
export const MIN_WITHDRAWAL = 110;
export const WINGO_MIN_BET = 1;
export const WINGO_MAX_BET = 5000;
export const AVIATOR_MIN_BET = 10;
export const AVIATOR_MAX_BET = 50000;
