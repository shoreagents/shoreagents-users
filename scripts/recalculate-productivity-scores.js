// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { Client } = require('pg');

async function recalculateProductivityScores() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database');

    // Get user ID (assuming user 2 exists)
    const userResult = await client.query('SELECT id FROM users WHERE id = 2 LIMIT 1');
    if (userResult.rows.length === 0) {
      console.log('❌ User with ID 2 not found. Please create a user first.');
      return;
    }
    const userId = userResult.rows[0].id;
    console.log(`✅ Using user ID: ${userId}`);

    // Get all months that have activity data
    const monthsQuery = `
      SELECT DISTINCT 
        TO_CHAR(today_date, 'YYYY-MM') as month_year
      FROM activity_data 
      WHERE user_id = $1
      ORDER BY month_year;
    `;

    const monthsResult = await client.query(monthsQuery, [userId]);
    const months = monthsResult.rows.map(row => row.month_year);

    console.log(`📊 Recalculating productivity scores for ${months.length} months...\n`);

    for (const monthYear of months) {
      try {
        // Use the database function to calculate productivity score
        const calculateQuery = `
          SELECT calculate_monthly_productivity_score($1, $2) as productivity_score;
        `;

        const result = await client.query(calculateQuery, [userId, monthYear]);
        const productivityScore = result.rows[0].productivity_score;

        console.log(`✅ ${monthYear}: ${productivityScore} pts`);

      } catch (error) {
        console.error(`❌ Error calculating for ${monthYear}:`, error.message);
      }
    }

    // Show updated productivity scores
    console.log('\n📋 Updated Productivity Scores:');
    const scoresQuery = `
      SELECT 
        month_year,
        productivity_score,
        total_active_seconds,
        total_inactive_seconds,
        ROUND(total_active_seconds::DECIMAL / 3600, 2) as active_hours,
        ROUND(total_inactive_seconds::DECIMAL / 3600, 2) as inactive_hours,
        active_percentage
      FROM productivity_scores 
      WHERE user_id = $1
      ORDER BY month_year;
    `;

    const scoresResult = await client.query(scoresQuery, [userId]);
    
    scoresResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.month_year}:`);
      console.log(`      Score: ${row.productivity_score} pts`);
      console.log(`      Active: ${row.active_hours} hours`);
      console.log(`      Inactive: ${row.inactive_hours} hours`);
      console.log(`      Percentage: ${parseFloat(row.active_percentage).toFixed(1)}%`);
    });

    // Show summary
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_months,
        ROUND(AVG(productivity_score), 2) as avg_score,
        ROUND(MAX(productivity_score), 2) as max_score,
        ROUND(MIN(productivity_score), 2) as min_score
      FROM productivity_scores 
      WHERE user_id = $1;
    `;

    const summaryResult = await client.query(summaryQuery, [userId]);
    const summary = summaryResult.rows[0];

    console.log('\n📊 Productivity Summary:');
    console.log(`   Total Months: ${summary.total_months}`);
    console.log(`   Average Score: ${summary.avg_score} pts`);
    console.log(`   Highest Score: ${summary.max_score} pts`);
    console.log(`   Lowest Score: ${summary.min_score} pts`);

    console.log(`\n✅ Successfully recalculated productivity scores for ${months.length} months!`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
    console.log('🔌 Disconnected from database');
  }
}

recalculateProductivityScores();
