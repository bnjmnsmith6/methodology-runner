/**
 * Grade Bundle Writer
 * 
 * Writes hard gate results and grade checks to Supabase.
 * Every build gets a grade_run with individual grade_checks.
 */

import { supabase } from '../db/client.js';
import { GateResult } from './hard-gates.js';

/**
 * Write a grade bundle to Supabase
 */
export async function writeGradeBundle(
  pipelineRunId: string | null,
  gateResult: GateResult,
  phase: string = 'pre-ship'
): Promise<string | null> {
    console.warn('   No pipeline run ID - skipping grade bundle write');
    return null;
  }

  try {
    // 1. Create grade_run
    const passedCount = gateResult.checks.filter(c => c.passed).length;
    const totalCount = gateResult.checks.length;
    const score = totalCount > 0 ? (passedCount / totalCount) * 5 : 0;

    const { data: gradeRun, error: gradeError } = await supabase
      .from('grade_runs')
      .insert({
        run_id: pipelineRunId,
        phase,
        hard_gate_pass: gateResult.hard_gate_pass,
        quality_score: parseFloat(score.toFixed(2)),
        confidence: 1.0,
        grader_version: 'hard-gates-v1',
        summary: gateResult.summary,
        details: {
          passed_count: passedCount,
          total_count: totalCount,
        },
      })
      .select('id')
      .single();

    if (gradeError) {
      console.warn('   Failed to write grade_run: ' + gradeError.message);
      return null;
    }

    const gradeRunId = gradeRun.id;

    // 2. Create individual grade_checks
    const checks = gateResult.checks.map(check => ({
      grade_run_id: gradeRunId,
      dimension: check.dimension,
      checker_type: check.checker_type,
      score: check.passed ? 5.0 : 0.0,
      passed: check.passed,
      weight: 1.0,
      evidence: check.evidence,
      notes: check.notes,
    }));

    const { error: checksError } = await supabase
      .from('grade_checks')
      .insert(checks);

    if (checksError) {
      console.warn('   Failed to write grade_checks: ' + checksError.message);
    }

    console.log('   Grade bundle written: ' + gradeRunId + ' (' + passedCount + '/' + totalCount + ' passed)');
    return gradeRunId;

  } catch (error: any) {
    console.warn('   Failed to write grade bundle: ' + error.message);
    return null;
  }
}
