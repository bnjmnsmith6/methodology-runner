/**
 * Lease heartbeat - renews job lease during long builds
 */

import { supabase } from '../../db/client.js';

export interface Heartbeat {
  stop: () => void;
}

/**
 * Start heartbeat to renew job lease while build is running
 * 
 * Updates the lease expiry every intervalMs to keep the job
 * alive and prevent it from being picked up by another worker.
 */
export function startHeartbeat(jobId: string, intervalMs: number = 30000): Heartbeat {
  let stopped = false;
  
  const renewLease = async () => {
    if (stopped) return;
    
    try {
      // Extend lease by 45 minutes from now
      const leaseExpiresAt = new Date(Date.now() + 45 * 60 * 1000).toISOString();
      
      const { error } = await supabase
        .from('jobs')
        .update({ lease_expires_at: leaseExpiresAt })
        .eq('id', jobId)
        .eq('status', 'RUNNING');  // Only update if still running
      
      if (error) {
        console.warn(`   ⚠️  Heartbeat failed to renew lease: ${error.message}`);
      } else {
        console.log(`   💓 Heartbeat renewed lease for job ${jobId.slice(0, 8)}...`);
      }
    } catch (error: any) {
      console.warn(`   ⚠️  Heartbeat error: ${error.message}`);
    }
  };
  
  // Start the interval
  const intervalId = setInterval(renewLease, intervalMs);
  
  // Initial renewal
  renewLease();
  
  return {
    stop: () => {
      stopped = true;
      clearInterval(intervalId);
      console.log(`   🛑 Heartbeat stopped for job ${jobId.slice(0, 8)}...`);
    }
  };
}
