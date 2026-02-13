interface ValidationSuccess<T> {
  ok: true;
  value: T;
}

interface ValidationFailure {
  ok: false;
  error: string;
}

type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
  teamName?: string;
}

export interface LoginInput {
  emailOrUsername: string;
  password: string;
  rememberMe: boolean;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
}

const toTrimmedString = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : '';
}

const toOptionalTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export function validateRegisterInput(body: unknown): ValidationResult<RegisterInput> {
  if (!isRecord(body)) {
    return { ok: false, error: 'Missing required fields: email, username, password' };
  }

  const email = toTrimmedString(body.email);
  const username = toTrimmedString(body.username);
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !username || !password) {
    return { ok: false, error: 'Missing required fields: email, username, password' };
  }

  if (!emailRegex.test(email)) {
    return { ok: false, error: 'Invalid email format' };
  }

  if (!usernameRegex.test(username)) {
    return {ok: false, error: 'Invalid username: must be 3-30 characters, alphanumeric, underscore, or hyphen',};
  }

  if (password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters long' };
  }

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNum = /[0-9]/.test(password);
  const hasSpec = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (!hasUpper || !hasLower || !hasNum || !hasSpec) {
    return {ok: false, error: 'Password must contain uppercase, lowercase, number, and special character',};
  }

  const teamName = toOptionalTrimmedString(body.teamName);

  return {ok: true, value: {email, username, password, teamName,},};
}

export function validateLoginInput(body: unknown): ValidationResult<LoginInput> {
  if (!isRecord(body)) {
    return { ok: false, error: 'Missing required fields: email, password' };
  }

  const emailOrUsername = toTrimmedString(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  const rememberMe = typeof body.rememberMe === 'boolean' ? body.rememberMe : false;

  if (!emailOrUsername || !password) {
    return { ok: false, error: 'Missing required fields: email, password' };
  }

  return {ok: true, value: {emailOrUsername, password, rememberMe,},};
}
