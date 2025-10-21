import { describe, expect, it, afterEach, vi } from 'vitest';

let createMessageCalledWith: any;

vi.mock('twilio', () => ({
  default: () => ({
    messages: {
      create: (args: any) => {
        createMessageCalledWith = args;
        return Promise.resolve(true);
      }
    }
  })
}));

describe('SMSNotification Tests', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('Shoud make SMS\'s sender equals Constants.senderPhoneNumber for a not allowed shortName country', async () => {
    const mockName = 'username';

    const mockUsers = [
      {
        internationalPrefix: '+1',
        mobile: '9999999999'
      }
    ];

  });

  it('Shoud make SMS\'s sender equals Constants.senderShortName for a allowed shortName country', async () => {
    const mockName = 'username';

    const mockUsers = [
      {
        internationalPrefix: '+41',
        mobile: '9999999999'
      }
    ];

  });
});