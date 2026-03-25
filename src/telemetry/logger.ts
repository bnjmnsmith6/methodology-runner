/**
 * Telemetry Logger
 * 
 * Tracks pipeline runs and step executions for quality analysis and replay
 */

import { supabase } from '../db/client.js';

/**
 * Start a pipeline run when an RP begins processing
 */
export async function startPipelineRun(
  projectId: string,
  rpId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('pipeline_runs')
    .insert({
      project_id: projectId,
      rp_id: rpId,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('   ❌ Failed to start pipeline run:', error);
    throw new Error(`Failed to start pipeline run: ${error.message}`);
  }

  console.log(`   📊 Started pipeline run: ${data.id}`);
  return data.id;
}

/**
 * Log a step execution
 */
export async function logStep(params: {
  pipelineRunId: string;
  rpId: string;
  stepName: string;
  jobId?: string;
  status: string;
  startedAt: Date;
  completedAt: Date;
  costUsd?: number;
  tokensIn?: number;
  tokensOut?: number;
  promptHash?: string;
  promptVersion?: string;
  rubricVersion?: string;
  selfGrade?: number;
  selfGradeReasons?: string[];
  outputSummary?: string;
  artifactPaths?: string[];
  metadata?: Record<string, any>;
}): Promise<void> {
  const durationMs = params.completedAt.getTime() - params.startedAt.getTime();

  const { error } = await supabase
    .from('step_logs')
    .insert({
      pipeline_run_id: params.pipelineRunId,
      rp_id: params.rpId,
      step_name: params.stepName,
      job_id: params.jobId || null,
      status: params.status,
      started_at: params.startedAt.toISOString(),
      completed_at: params.completedAt.toISOString(),
      duration_ms: durationMs,
      cost_usd: params.costUsd || null,
      tokens_in: params.tokensIn || null,
      tokens_out: params.tokensOut || null,
      prompt_hash: params.promptHash || null,
      prompt_version: params.promptVersion || null,
      rubric_version: params.rubricVersion || null,
      self_grade: params.selfGrade || null,
      self_grade_reasons: params.selfGradeReasons || null,
      output_summary: params.outputSummary || null,
      artifact_paths: params.artifactPaths || [],
      metadata: params.metadata || {},
    });

  if (error) {
    console.error('   ❌ Failed to log step:', error);
    // Don't throw - telemetry should never block the pipeline
  } else {
    console.log(`   📊 Logged step: ${params.stepName} (${durationMs}ms, $${params.costUsd || 0})`);
  }
}

/**
 * Update step with self-grade after grading completes
 */
export async function updateStepGrade(
  pipelineRunId: string,
  stepName: string,
  grade: {
    score: number;
    reasons: string[];
    rubricVersion: string;
  }
): Promise<void> {
  const { error } = await supabase
    .from('step_logs')
    .update({
      self_grade: grade.score,
      self_grade_reasons: grade.reasons,
      rubric_version: grade.rubricVersion,
    })
    .eq('pipeline_run_id', pipelineRunId)
    .eq('step_name', stepName);

  if (error) {
    console.error('   ❌ Failed to update step grade:', error);
  } else {
    console.log(`   📊 Updated grade for ${stepName}: ${grade.score}/5`);
  }
}

/**
 * Complete a pipeline run
 */
export async function completePipelineRun(
  pipelineRunId: string,
  status: 'completed' | 'failed' | 'abandoned',
  totalCost?: number
): Promise<void> {
  // Get all step logs to compute aggregates
  const { data: steps, error: stepsError } = await supabase
    .from('step_logs')
    .select('*')
    .eq('pipeline_run_id', pipelineRunId);

  if (stepsError) {
    console.error('   ❌ Failed to fetch steps for pipeline run:', stepsError);
    return;
  }

  // Compute aggregates
  const totalDurationMs = steps?.reduce((sum, s) => sum + (s.duration_ms || 0), 0) || 0;
  const totalApiCalls = steps?.length || 0;
  const stepGrades: Record<string, number> = {};
  
  steps?.forEach(step => {
    if (step.self_grade) {
      stepGrades[step.step_name] = step.self_grade;
    }
  });

  // Compute overall grade (average of step grades)
  const gradeValues = Object.values(stepGrades);
  const overallGrade = gradeValues.length > 0
    ? gradeValues.reduce((sum, g) => sum + g, 0) / gradeValues.length
    : null;

  // Update pipeline run
  const { error } = await supabase
    .from('pipeline_runs')
    .update({
      status,
      completed_at: new Date().toISOString(),
      total_cost_usd: totalCost || 0,
      total_duration_ms: totalDurationMs,
      total_api_calls: totalApiCalls,
      step_grades: stepGrades,
      overall_grade: overallGrade,
    })
    .eq('id', pipelineRunId);

  if (error) {
    console.error('   ❌ Failed to complete pipeline run:', error);
  } else {
    console.log(`   📊 Completed pipeline run: ${status} (${totalDurationMs}ms, $${totalCost || 0})`);
    if (overallGrade) {
      console.log(`   🎯 Overall grade: ${overallGrade.toFixed(2)}/5`);
    }
  }
}

/**
 * Record human grade for a pipeline run
 */
export async function recordHumanGrade(
  pipelineRunId: string,
  grade: {
    score: number;
    builtRightThing: 'yes' | 'almost' | 'no';
    mainMiss: string;
    notes?: string;
  }
): Promise<void> {
  const { error } = await supabase
    .from('pipeline_runs')
    .update({
      human_grade: {
        score: grade.score,
        built_right_thing: grade.builtRightThing,
        main_miss: grade.mainMiss,
        notes: grade.notes || null,
        graded_at: new Date().toISOString(),
      },
    })
    .eq('id', pipelineRunId);

  if (error) {
    console.error('   ❌ Failed to record human grade:', error);
    throw new Error(`Failed to record human grade: ${error.message}`);
  }

  console.log(`   ⭐ Human grade recorded: ${grade.score}/5 (${grade.builtRightThing})`);
}

/**
 * Get pipeline run by RP ID
 */
export async function getPipelineRunByRp(rpId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('pipeline_runs')
    .select('*')
    .eq('rp_id', rpId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('   ❌ Failed to get pipeline run:', error);
    return null;
  }

  return data;
}
