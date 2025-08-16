#!/usr/bin/env node

/**
 * Fix Break Durations Script
 * Updates break sessions with missing or incorrect duration_minutes
 */

async function fixBreakDurations() {
  try {
    console.log('🔧 Fixing break durations...');

    // SQL to update missing or incorrect durations
    const fixDurationsSQL = `
      UPDATE break_sessions 
      SET duration_minutes = 
        CASE 
          WHEN end_time IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (end_time - start_time)) / 60
          WHEN pause_time IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (pause_time - start_time)) / 60
          ELSE 
            EXTRACT(EPOCH FROM (NOW() - start_time)) / 60
        END
      WHERE 
        (duration_minutes IS NULL OR duration_minutes = 0)
        AND start_time IS NOT NULL
        AND start_time >= CURRENT_DATE - INTERVAL '7 days'
      RETURNING id, break_type, start_time, end_time, pause_time, duration_minutes
    `;

    console.log('📝 Updating missing break durations...');
    
    // Execute the SQL using the migration API
    const response = await fetch((process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000') + '/api/database/migrate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: fixDurationsSQL,
        description: 'Fix missing break durations'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fix durations');
    }

    console.log('✅ Break durations fixed successfully!');
    console.log('');
    console.log('📊 Updated records:', result.result?.length || 0);
    
    if (result.result && result.result.length > 0) {
      console.log('📝 Updated break sessions:');
      result.result.forEach((session: any) => {
        console.log(`  • ${session.break_type}: ${session.duration_minutes}m (${session.start_time} - ${session.end_time || 'active'})`);
      });
    }

  } catch (error) {
    console.error('❌ Failed to fix break durations:', error);
    console.log('');
    console.log(`💡 Make sure your app is running on ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}`);
    console.log('💡 Or run: npm run dev');
    process.exit(1);
  }
}

// Run the fix
fixBreakDurations(); 