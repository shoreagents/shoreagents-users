#!/usr/bin/env node

/**
 * Fix Break Duration Calculation Script
 * Updates the database function to properly calculate duration for auto-ended paused breaks
 */

async function fixBreakDuration() {
  try {
    console.log('🔧 Fixing break duration calculation...');

    // SQL to update the duration calculation function
    const updateFunctionSQL = `
      CREATE OR REPLACE FUNCTION public.calculate_break_duration()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $function$
      BEGIN
          -- If end_time is being set and start_time exists, calculate duration
          IF NEW.end_time IS NOT NULL AND NEW.start_time IS NOT NULL THEN
              -- If break was paused, calculate based on pause state
              IF NEW.pause_time IS NOT NULL THEN
                  -- If break was resumed, use normal pause calculation
                  IF NEW.resume_time IS NOT NULL THEN
                      -- Total duration = (pause_time - start_time) + (end_time - resume_time)
                      NEW.duration_minutes = EXTRACT(EPOCH FROM (
                          (NEW.pause_time - NEW.start_time) + 
                          (NEW.end_time - NEW.resume_time)
                      )) / 60;
                  ELSE
                      -- Break was paused but never resumed (auto-ended)
                      -- Use the time from start to pause as the actual break duration
                      NEW.duration_minutes = EXTRACT(EPOCH FROM (NEW.pause_time - NEW.start_time)) / 60;
                  END IF;
              ELSE
                  -- Normal calculation for non-paused breaks
                  NEW.duration_minutes = EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60;
              END IF;
          END IF;
          RETURN NEW;
      END;
      $function$;
    `;

    // Add comment to explain the function
    const commentSQL = `
      COMMENT ON FUNCTION public.calculate_break_duration() IS 
      'Calculates break duration in minutes. For paused breaks that are auto-ended, uses time from start to pause as the actual break duration.';
    `;

    console.log('📝 Updating duration calculation function...');
    
    // Execute the SQL using the migration API
    const response = await fetch((process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000') + '/api/database/migrate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: updateFunctionSQL,
        description: 'Update break duration calculation function'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to update function');
    }

    console.log('📝 Adding function comment...');
    
    const commentResponse = await fetch((process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000') + '/api/database/migrate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: commentSQL,
        description: 'Add function comment'
      })
    });

    if (!commentResponse.ok) {
      throw new Error(`HTTP error! status: ${commentResponse.status}`);
    }

    const commentResult = await commentResponse.json();
    
    if (!commentResult.success) {
      throw new Error(commentResult.error || 'Failed to add comment');
    }

    console.log('✅ Break duration calculation fixed successfully!');
    console.log('');
    console.log('📊 What this fixes:');
    console.log('  • Paused breaks that are auto-ended will now show correct duration');
    console.log('  • Duration will be calculated from start_time to pause_time');
    console.log('  • Instead of from start_time to end_time (which could be much later)');
    console.log('');
    console.log('🔄 The fix will apply to all future break sessions.');

  } catch (error) {
    console.error('❌ Failed to fix break duration calculation:', error);
    console.log('');
    console.log(`💡 Make sure your app is running on ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}`);
    console.log('💡 Or run: npm run dev');
    process.exit(1);
  }
}

// Run the fix
fixBreakDuration(); 