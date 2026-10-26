export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

type EnvSource = Record<string, string | undefined>;

const DURATION_UNITS_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export class EnvReader {
  constructor(private readonly source: EnvSource = process.env) {}

  optionalString(name: string): string | undefined {
    return this.source[name]?.trim() || undefined;
  }

  string(name: string, fallback: string): string {
    return this.optionalString(name) ?? fallback;
  }

  required(name: string, message: string): string {
    const value = this.optionalString(name);

    if (value === undefined) {
      throw new ConfigError(message);
    }

    return value;
  }

  int(name: string, fallback: number): number {
    const value = this.optionalString(name);

    if (value === undefined) return fallback;
    if (!/^-?\d+$/.test(value)) {
      throw new ConfigError(`${name} must be an integer, got "${value}"`);
    }

    return parseInt(value, 10);
  }

  positiveInt(name: string, fallback: number): number {
    const value = this.int(name, fallback);

    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new ConfigError(`${name} must be a positive safe integer, got "${value}"`);
    }

    return value;
  }

  float(name: string, fallback: number): number {
    const value = this.optionalString(name);

    if (value === undefined) return fallback;
    const number = Number(value);
    if (!Number.isFinite(number)) {
      throw new ConfigError(`${name} must be a number, got "${value}"`);
    }

    return number;
  }

  // Accepts true/false/1/0, case-insensitive.
  flag(name: string, fallback: boolean): boolean {
    const value = this.optionalString(name);

    if (value === undefined) return fallback;
    if (['true', '1'].includes(value.toLowerCase())) return true;
    if (['false', '0'].includes(value.toLowerCase())) return false;

    throw new ConfigError(`${name} must be true or false, got "${value}"`);
  }

  list(name: string): string[] {
    return this.string(name, '').split(',').map(item => item.trim()).filter(Boolean);
  }

  // Requires a unit: ms, s, m, h or d.
  durationMs(name: string, fallback: string): number {
    const value = this.string(name, fallback);
    const match = value.match(/^(\d+)(ms|s|m|h|d)$/);

    if (!match) {
      throw new ConfigError(`${name} has invalid duration format: ${value}`);
    }

    return parseInt(match[1], 10) * DURATION_UNITS_MS[match[2]];
  }
}
