import { AppConfig, ConfigError, EnvReader } from '..';

function createConfig(overrides: Record<string, string> = {}): AppConfig {
  return new AppConfig(new EnvReader({
    DATABASE_URL: 'postgres://localhost/autotrace_test',
    ...overrides,
  }));
}

describe('rate limit configuration', () => {
  it('uses the existing defaults when limits are unset', () => {
    const config = createConfig();

    expect(() => config.validate()).not.toThrow();
    expect(config.rateLimit).toEqual({ apiPerMinute: 100, telemetryPerMinute: 500 });
  });

  it('accepts positive integer overrides, including a limit of one', () => {
    const config = createConfig({ RATE_LIMIT_REQUESTS: '1', TELEMETRY_RATE_LIMIT: '750' });

    expect(() => config.validate()).not.toThrow();
    expect(config.rateLimit).toEqual({ apiPerMinute: 1, telemetryPerMinute: 750 });
  });

  describe.each(['RATE_LIMIT_REQUESTS', 'TELEMETRY_RATE_LIMIT'])('%s', name => {
    it.each(['0', '-1', '1.5', 'invalid', '9007199254740992'])(
      'rejects %s during startup validation and direct access', value => {
        const config = createConfig({ [name]: value });

        expect(() => config.validate()).toThrow(ConfigError);
        expect(() => config.validate()).toThrow(name);
        expect(() => config.rateLimit).toThrow(ConfigError);
      }
    );
  });
});
