import keytar from 'keytar';

const SERVICE_NAME = 'background-agent';
const OPENROUTER_ACCOUNT = 'openrouter_api_key';

export class KeyStore {
  async setOpenRouterKey(value: string): Promise<void> {
    await keytar.setPassword(SERVICE_NAME, OPENROUTER_ACCOUNT, value.trim());
  }

  async getOpenRouterKey(): Promise<string | null> {
    const value = await keytar.getPassword(SERVICE_NAME, OPENROUTER_ACCOUNT);
    return value?.trim() ?? null;
  }

  async hasOpenRouterKey(): Promise<boolean> {
    const value = await this.getOpenRouterKey();
    return Boolean(value);
  }
}
