# 🧪 Shift-Based Activity System Testing

This directory contains test scripts to verify the shift-based activity data system works correctly.

## 📋 Test Scripts

### 1. **Full Test Suite** (`test-shift-activity-system.js`)
Comprehensive test suite that covers all scenarios:
- Day shift vs Night shift behavior
- Shift-anchored date calculation
- Timer start/stop guards
- New row creation logic
- API behavior simulation

**Run with:**
```bash
node scripts/run-shift-tests.js
```

### 2. **Specific Scenario Test** (`test-specific-shift.js`)
Test a specific user/shift/time combination:

**Usage:**
```bash
node scripts/test-specific-shift.js [email] [shift-time] [test-time]
```

**Examples:**
```bash
# Day shift during work hours
node scripts/test-specific-shift.js "john@example.com" "6:00 AM - 3:30 PM" "2025-08-18 10:30:00"

# Day shift before start
node scripts/test-specific-shift.js "john@example.com" "6:00 AM - 3:30 PM" "2025-08-18 05:30:00"

# Night shift after midnight
node scripts/test-specific-shift.js "jane@example.com" "10:00 PM - 6:00 AM" "2025-08-19 02:00:00"

# Night shift at end
node scripts/test-specific-shift.js "jane@example.com" "10:00 PM - 6:00 AM" "2025-08-19 06:00:00"
```

## 🎯 What Gets Tested

### ✅ **Date Calculation**
- Shift-anchored date logic
- Before shift start → previous day
- At/after shift start → current day
- Night shift spanning 2 calendar days

### ✅ **Timer Guards**
- No counting before shift start
- No counting after shift end
- Proper counting during shift hours
- Night shift continuous counting

### ✅ **Database Behavior**
- New row creation with 0 values
- Existing row detection
- Proper `today_date` assignment
- Activity data structure

### ✅ **API Simulation**
- Activity endpoint behavior
- Shift start time parsing
- Database query logic
- Error handling

## 📊 Expected Results

### **Day Shift (6:00 AM - 3:30 PM)**
| Time | Row Date | Timer | Behavior |
|------|----------|-------|----------|
| 5:30 AM | Previous day | ❌ Stopped | Before shift |
| 6:00 AM | Current day | ✅ Counting | Shift starts |
| 10:30 AM | Current day | ✅ Counting | During shift |
| 3:30 PM | Current day | ❌ Stopped | Shift ends |

### **Night Shift (10:00 PM - 6:00 AM)**
| Time | Calendar Date | Row Date | Timer | Behavior |
|------|---------------|----------|-------|----------|
| Aug 18, 9:30 PM | Aug 18 | Aug 17 | ❌ Stopped | Before shift |
| Aug 18, 10:00 PM | Aug 18 | Aug 18 | ✅ Counting | Shift starts |
| Aug 19, 2:00 AM | Aug 19 | Aug 18 | ✅ Counting | Same shift |
| Aug 19, 6:00 AM | Aug 19 | Aug 18 | ❌ Stopped | Shift ends |

## 🚀 Quick Test Commands

```bash
# Run full test suite
npm run test:shifts
# or
node scripts/run-shift-tests.js

# Test day shift scenarios
node scripts/test-specific-shift.js "day@test.com" "6:00 AM - 3:30 PM" "2025-08-18 10:00:00"

# Test night shift scenarios  
node scripts/test-specific-shift.js "night@test.com" "10:00 PM - 6:00 AM" "2025-08-19 02:00:00"

# Test edge cases
node scripts/test-specific-shift.js "edge@test.com" "6:00 AM - 3:30 PM" "2025-08-18 05:59:00"
node scripts/test-specific-shift.js "edge@test.com" "6:00 AM - 3:30 PM" "2025-08-18 15:31:00"
```

## 🔧 Setup Requirements

1. **Environment**: Make sure `.env` file has `DATABASE_URL`
2. **Database**: PostgreSQL with activity_data, users, job_info tables
3. **Node.js**: Version 14+ with required dependencies

## 📈 Interpreting Results

### ✅ **Success Indicators**
- All date calculations match expected values
- Timer guards work correctly (start/stop at right times)
- New rows created with 0 initial values
- Existing rows found with correct dates
- No database errors

### ❌ **Failure Indicators**
- Date calculation mismatches
- Timer counting outside shift hours
- Wrong row dates for night shifts
- Database connection errors
- API simulation failures

## 🐛 Troubleshooting

**Common Issues:**
1. **Database connection**: Check `DATABASE_URL` in `.env`
2. **Timezone issues**: Ensure Asia/Manila timezone handling
3. **Shift parsing**: Verify shift time format (e.g., "6:00 AM - 3:30 PM")
4. **Missing tables**: Run database migrations first

**Debug Mode:**
Add `console.log` statements in test scripts to see detailed execution flow.
