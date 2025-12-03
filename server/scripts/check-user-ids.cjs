/**
 * Script to check for invalid user IDs in team_posts collection
 * Run with: node server/scripts/check-user-ids.js
 */

require('dotenv').config();
const { connectToDatabase, getCollection } = require('../lib/db');
const { ObjectId } = require('mongodb');

async function checkUserIds() {
    try {
        await connectToDatabase();
        console.log('Connected to database\n');

        const teamPosts = getCollection('team_posts');
        const allPosts = await teamPosts.find({}).toArray();

        console.log(`Total team posts: ${allPosts.length}\n`);
        
        let invalidCount = 0;
        const invalidPosts = [];

        for (const post of allPosts) {
            const createdById = post.createdBy?.id;
            let idString = null;
            let isValid = false;

            if (createdById instanceof ObjectId) {
                idString = createdById.toString();
                isValid = true;
            } else if (typeof createdById === 'string') {
                idString = createdById;
                isValid = ObjectId.isValid(createdById) && createdById.length === 24;
            } else if (createdById) {
                idString = String(createdById);
                isValid = false;
            }

            if (!isValid && createdById) {
                invalidCount++;
                invalidPosts.push({
                    postId: post._id.toString(),
                    postTitle: post.title,
                    createdById: idString,
                    idType: typeof createdById,
                    idLength: idString?.length
                });
            }

            // Also check members
            if (post.members && Array.isArray(post.members)) {
                for (const member of post.members) {
                    const memberId = member.id;
                    let memberIdString = null;
                    let memberIdValid = false;

                    if (memberId instanceof ObjectId) {
                        memberIdString = memberId.toString();
                        memberIdValid = true;
                    } else if (typeof memberId === 'string') {
                        memberIdString = memberId;
                        memberIdValid = ObjectId.isValid(memberId) && memberId.length === 24;
                    } else if (memberId) {
                        memberIdString = String(memberId);
                        memberIdValid = false;
                    }

                    if (!memberIdValid && memberId) {
                        console.log(`  Invalid member ID in post "${post.title}": ${memberIdString} (${typeof memberId})`);
                    }
                }
            }
        }

        if (invalidPosts.length > 0) {
            console.log('\n=== Invalid createdBy.id found ===\n');
            for (const p of invalidPosts) {
                console.log(`Post: "${p.postTitle}"`);
                console.log(`  Post ID: ${p.postId}`);
                console.log(`  CreatedBy ID: ${p.createdById}`);
                console.log(`  Type: ${p.idType}, Length: ${p.idLength}`);
                console.log('');
            }
            console.log(`\nTotal invalid: ${invalidCount}/${allPosts.length}`);
        } else {
            console.log('✅ All createdBy.id values are valid ObjectIds');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkUserIds();
