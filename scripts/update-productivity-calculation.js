// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { Client } = require('pg');

async function updateProductivityCalculation() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database');

    // Update the productivity score calculation function
    console.log('🔄 Updating productivity calculation function...');
    
    const updateFunctionSQL = `
      -- Function to calculate productivity score
      -- New formula: +1 point per hour active, -1 point per hour inactive
      -- Final score = active_points - inactive_points
      CREATE OR REPLACE FUNCTION calculate_productivity_score(
          active_seconds INTEGER,
          inactive_seconds INTEGER
      )
      RETURNS DECIMAL(5,2) AS $$
      DECLARE
          active_points DECIMAL(5,2);
          inactive_points DECIMAL(5,2);
          productivity_score DECIMAL(5,2);
      BEGIN
          -- Calculate points based on hours
          -- +1 point for every 3600 seconds (1 hour) of active time
          active_points := (active_seconds::DECIMAL / 3600.0);
          
          -- -1 point for every 3600 seconds (1 hour) of inactive time
          inactive_points := (inactive_seconds::DECIMAL / 3600.0);
          
          -- Final score = active points - inactive points
          productivity_score := active_points - inactive_points;
          
          -- Ensure score is not negative (minimum 0)
          IF productivity_score < 0 THEN
              productivity_score := 0.00;
          END IF;
          
          RETURN ROUND(productivity_score, 2);
      END;
      $$ language 'plpgsql';
    `;
    
    await client.query(updateFunctionSQL);
    console.log('✅ Productivity calculation function updated');

    // Update existing productivity scores with new calculation
    console.log('🔄 Updating existing productivity scores...');
    
    const updateQuery = `
      UPDATE productivity_scores 
      SET 
        productivity_score = calculate_productivity_score(total_active_seconds, total_inactive_seconds),
        updated_at = NOW()
      WHERE id > 0;
    `;
    
    const result = await client.query(updateQuery);
    console.log(`✅ Updated ${result.rowCount} existing productivity scores`);

    // Show some examples of the new calculation
    console.log('\n📊 Example calculations with new system:');
    console.log('8 hours active (28800s) + 2 hours inactive (7200s) = 8 - 2 = 6 points');
    console.log('6 hours active (21600s) + 4 hours inactive (14400s) = 6 - 4 = 2 points');
    console.log('4 hours active (14400s) + 6 hours inactive (21600s) = 4 - 6 = 0 points (minimum)');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
    console.log('🔌 Disconnected from database');
  }
}

updateProductivityCalculation();
