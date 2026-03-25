import { updateRpState } from '../src/services/projects.js';
import { StepStatus } from '../src/core/types.js';

async function main() {
  const rpId = process.argv[2];
  const targetStep = parseInt(process.argv[3], 10);

  if (!rpId || !targetStep) {
    console.error('Usage: npm run advance-rp <rp-id> <target-step>');
    console.error('Example: npm run advance-rp cb59d60e-cfb5-4c9e-81e4-4e974ac35001 5');
    process.exit(1);
  }

  console.log(`\n🔄 Advancing RP ${rpId} to step ${targetStep}...\n`);

  await updateRpState(rpId, {
    step: targetStep,
    step_status: StepStatus.NOT_STARTED,
  });

  console.log(`✅ RP advanced to step ${targetStep}!`);
  console.log(`🔄 Worker will pick up jobs from this step automatically.\n`);
}

main().catch(console.error).finally(() => process.exit(0));
