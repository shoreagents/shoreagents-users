#!/usr/bin/env node

/**
 * Quick Announcement Sender
 * Sends immediate announcements to specified users without scheduling or expiration
 * Usage: node send-quick-announcement.js
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Interactive prompt function
function prompt(question) {
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

// Get user input
async function getUserInput() {
    console.log('\n🚀 Quick Announcement Sender');
    console.log('=============================\n');

    const title = await prompt('📝 Announcement Title: ');
    if (!title.trim()) {
        console.log('❌ Title is required!');
        process.exit(1);
    }

    const message = await prompt('💬 Message: ');
    if (!message.trim()) {
        console.log('❌ Message is required!');
        process.exit(1);
    }

    console.log('\n📋 Priority Options:');
    console.log('1. low');
    console.log('2. medium (default)');
    console.log('3. high');
    console.log('4. urgent');
    
    const priorityChoice = await prompt('🎯 Priority (1-4, default: 2): ');
    const priorityMap = { '1': 'low', '2': 'medium', '3': 'high', '4': 'urgent' };
    const priority = priorityMap[priorityChoice] || 'medium';


    console.log('\n👥 Target Users:');
    console.log('Enter user IDs separated by commas (e.g., 1,2,3,4)');
    console.log('Or enter "all" to send to all users');
    
    const userInput = await prompt('👤 User IDs (or "all"): ');
    let assignedUserIds;

    if (userInput.toLowerCase() === 'all') {
        // Get all user IDs
        const result = await pool.query('SELECT id FROM users ORDER BY id');
        assignedUserIds = result.rows.map(row => row.id);
        console.log(`📊 Found ${assignedUserIds.length} users`);
    } else {
        assignedUserIds = userInput.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        if (assignedUserIds.length === 0) {
            console.log('❌ No valid user IDs provided!');
            process.exit(1);
        }
    }

    const allowDismiss = await prompt('❌ Allow users to dismiss? (y/n, default: y): ');
    const allowDismissBool = allowDismiss.toLowerCase() !== 'n';

    return {
        title: title.trim(),
        message: message.trim(),
        priority,
        assignedUserIds,
        allowDismiss: allowDismissBool
    };
}

// Send the announcement
async function sendQuickAnnouncement(announcementData) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Get admin user ID (assuming user ID 1 is admin, or get first internal user)
        const adminResult = await client.query(`
            SELECT id FROM users 
            WHERE user_type = 'Internal' OR id = 1 
            ORDER BY id 
            LIMIT 1
        `);
        
        if (adminResult.rows.length === 0) {
            throw new Error('No admin user found!');
        }
        
        const adminUserId = adminResult.rows[0].id;

        // Create the announcement
        const insertResult = await client.query(`
            INSERT INTO announcements (
                title, message, priority, status,
                assigned_user_ids, allow_dismiss, created_by
            ) VALUES ($1, $2, $3, 'draft', $4, $5, $6)
            RETURNING id
        `, [
            announcementData.title,
            announcementData.message,
            announcementData.priority,
            announcementData.assignedUserIds,
            announcementData.allowDismiss,
            adminUserId
        ]);

        const announcementId = insertResult.rows[0].id;

        // Create assignments
        await client.query(`
            SELECT create_announcement_assignments($1)
        `, [announcementId]);

        // Send the announcement
        await client.query(`
            SELECT send_announcement($1)
        `, [announcementId]);

        await client.query('COMMIT');

        console.log('\n✅ Announcement sent successfully!');
        console.log(`📋 ID: ${announcementId}`);
        console.log(`📝 Title: ${announcementData.title}`);
        console.log(`🎯 Priority: ${announcementData.priority}`);
        console.log(`👥 Target Users: ${announcementData.assignedUserIds.length} users`);
        console.log(`❌ Dismissible: ${announcementData.allowDismiss ? 'Yes' : 'No'}`);

        return announcementId;

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Main function
async function main() {
    try {
        const announcementData = await getUserInput();
        
        console.log('\n📤 Sending announcement...');
        const announcementId = await sendQuickAnnouncement(announcementData);
        
        console.log('\n🎉 Done! The announcement has been sent to all target users.');
        console.log('💡 Users will see the announcement in real-time via WebSocket notifications.');
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = { sendQuickAnnouncement, getUserInput };
