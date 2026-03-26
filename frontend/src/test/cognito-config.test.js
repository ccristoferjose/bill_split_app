import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Cognito Configuration', () => {
  it('should fail when VITE_COGNITO_USER_POOL_ID is not set', () => {
    const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
    expect(userPoolId, 'VITE_COGNITO_USER_POOL_ID is missing — add it to your .env file').toBeTruthy();
  });

  it('should fail when VITE_COGNITO_CLIENT_ID is not set', () => {
    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
    expect(clientId, 'VITE_COGNITO_CLIENT_ID is missing — add it to your .env file').toBeTruthy();
  });

  it('VITE_COGNITO_USER_POOL_ID should match expected format (region_id)', () => {
    const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
    if (!userPoolId) return; // skip if not set (caught by previous test)
    expect(userPoolId).toMatch(
      /^[a-z]{2}-[a-z]+-\d+_[A-Za-z0-9]+$/,
    );
  });

  it('VITE_COGNITO_CLIENT_ID should not be empty or a placeholder', () => {
    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
    if (!clientId) return;
    expect(clientId).not.toMatch(/^(your_|xxx|placeholder|changeme)/i);
    expect(clientId.length).toBeGreaterThanOrEqual(10);
  });

  it('Amplify.configure should receive valid Cognito config', async () => {
    const { Amplify } = await import('aws-amplify');
    const configureSpy = vi.spyOn(Amplify, 'configure');

    // Re-import cognito.js to trigger Amplify.configure
    await import('../../src/services/cognito.js');

    // Check that configure was called (may have been called before spy — check config directly)
    const config = Amplify.getConfig?.();
    if (config) {
      expect(config.Auth?.Cognito?.userPoolId).toBeTruthy();
      expect(config.Auth?.Cognito?.userPoolClientId).toBeTruthy();
    } else {
      // Fallback: just check the spy was called with non-empty values
      expect(configureSpy).toHaveBeenCalled();
      const callArg = configureSpy.mock.calls[0]?.[0];
      expect(callArg?.Auth?.Cognito?.userPoolId).toBeTruthy();
      expect(callArg?.Auth?.Cognito?.userPoolClientId).toBeTruthy();
    }

    configureSpy.mockRestore();
  });
});
