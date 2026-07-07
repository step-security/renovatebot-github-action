import axios, { isAxiosError } from 'axios';
import { error, group, info, notice, setFailed } from '@actions/core';
import { Input } from './input';
import { Renovate } from './renovate';
import fs from 'fs';

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/prefer-nullish-coalescing */
async function validateSubscription() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  let repoPrivate: boolean | undefined;

  if (eventPath && fs.existsSync(eventPath)) {
    const eventData = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
    repoPrivate = eventData?.repository?.private;
  }

  const upstream = 'renovatebot/github-action';
  const action = process.env.GITHUB_ACTION_REPOSITORY;
  const docsUrl =
    'https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions';

  info('');
  info('\u001b[1;36mStepSecurity Maintained Action\u001b[0m');
  info(`Secure drop-in replacement for ${upstream}`);
  if (repoPrivate === false)
    info('\u001b[32m\u2713 Free for public repositories\u001b[0m');
  info(`\u001b[36mLearn more:\u001b[0m ${docsUrl}`);
  info('');

  if (repoPrivate === false) return;

  const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';
  const body: Record<string, string> = { action: action || '' };
  if (serverUrl !== 'https://github.com') body.ghes_server = serverUrl;
  try {
    await axios.post(
      `https://agent.api.stepsecurity.io/v1/github/${process.env.GITHUB_REPOSITORY}/actions/maintained-actions-subscription`,
      body,
      { timeout: 3000 },
    );
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 403) {
      error(
        `\u001b[1;31mThis action requires a StepSecurity subscription for private repositories.\u001b[0m`,
      );
      error(
        `\u001b[31mLearn how to enable a subscription: ${docsUrl}\u001b[0m`,
      );
      process.exit(1);
    }
    info('Timeout or API not reachable. Continuing to next step.');
  }
}
/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/prefer-nullish-coalescing */

async function run(): Promise<void> {
  try {
    await validateSubscription();
    const input = new Input();
    const renovate = new Renovate(input);

    await group('Check Renovate version', async () => {
      const version = await renovate.runDockerContainerForVersion();
      notice(version, { title: 'Renovate CLI version' });
    });

    await renovate.runDockerContainer();
  } catch (err) {
    console.error(err);
    setFailed(err as Error);
  }
}

void run();
