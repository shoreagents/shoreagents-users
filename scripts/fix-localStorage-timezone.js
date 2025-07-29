// Fix localStorage Timezone Issues
// Run this in browser console or as a script

function fixLocalStorageTimezone() {
  console.log('🔧 Fixing localStorage timezone issues...');
  
  // Get local date in YYYY-MM-DD format
  const getLocalDateString = (date = new Date()) => {
    return date.toLocaleDateString('en-CA');
  };
  
  let fixed = 0;
  
  // Iterate through all localStorage keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    
    if (!key) continue;
    
    // Check for daily reset keys
    if (key.startsWith('shoreagents-daily-reset-')) {
      const value = localStorage.getItem(key);
      
      if (value && value.includes('T') && value.includes('Z')) {
        // This is an ISO string (UTC), convert to local date
        try {
          const utcDate = new Date(value);
          const localDate = getLocalDateString(utcDate);
          
          console.log(`📅 Fixing ${key}:`);
          console.log(`  Old (UTC): ${value}`);
          console.log(`  New (Local): ${localDate}`);
          
          localStorage.setItem(key, localDate);
          fixed++;
        } catch (error) {
          console.warn(`⚠️ Could not fix ${key}:`, error);
        }
      }
    }
    
    // Check for break-related localStorage that might have UTC dates
    if (key.startsWith('shoreagents-break-')) {
      const value = localStorage.getItem(key);
      
      try {
        const data = JSON.parse(value);
        let modified = false;
        
        // Fix any date fields that might be UTC
        if (data.date && typeof data.date === 'string' && data.date.includes('T')) {
          data.date = getLocalDateString(new Date(data.date));
          modified = true;
        }
        
        if (data.lastUpdated && typeof data.lastUpdated === 'string' && data.lastUpdated.includes('T')) {
          data.lastUpdated = getLocalDateString(new Date(data.lastUpdated));
          modified = true;
        }
        
        if (modified) {
          console.log(`🔧 Fixed break data in ${key}`);
          localStorage.setItem(key, JSON.stringify(data));
          fixed++;
        }
      } catch (error) {
        // Not JSON data, skip
      }
    }
  }
  
  console.log(`✅ Fixed ${fixed} localStorage entries`);
  
  // Show current timezone info
  console.log('\n📍 Current timezone info:');
  console.log(`Browser timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
  console.log(`Local date: ${getLocalDateString()}`);
  console.log(`UTC date: ${new Date().toISOString().split('T')[0]}`);
  
  if (getLocalDateString() !== new Date().toISOString().split('T')[0]) {
    console.log('⚠️ Local and UTC dates are different - timezone fixes are important!');
  } else {
    console.log('ℹ️ Local and UTC dates are the same today');
  }
}

// Run the fix
fixLocalStorageTimezone();

// Export for manual use
if (typeof window !== 'undefined') {
  window.fixLocalStorageTimezone = fixLocalStorageTimezone;
  console.log('\n💡 Function available as window.fixLocalStorageTimezone() for future use');
} 