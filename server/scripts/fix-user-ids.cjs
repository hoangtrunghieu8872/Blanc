/**
 * Script to fix invalid user IDs in team_posts collection
 * Run with: node server/scripts/fix-user-ids.cjs
 */

require('dotenv').config();
const { connectToDatabase, getCollection } = require('../lib/db');
const { ObjectId } = require('mongodb');

async function fixUserIds() {
    try {
        await connectToDatabase();
        console.log('Connected to database\n');

        const teamPosts = getCollection('team_posts');
        const users = getCollection('users');
        const allPosts = await teamPosts.find({}).toArray();

        console.log(`Total team posts: ${allPosts.length}\n`);

        let fixedCount = 0;

        for (const post of allPosts) {
            let needsUpdate = false;
            const updates = {};

            // Check createdBy.id
            const createdById = post.createdBy?.id;
            if (createdById && !(createdById instanceof ObjectId)) {
                const idStr = String(createdById);
                if (!ObjectId.isValid(idStr) || idStr.length !== 24) {
                    console.log(`\n[Post: "${post.title}"]`);
                    console.log(`  Invalid createdBy.id: ${idStr} (length: ${idStr.length})`);

                    // Try to find user by email or name
                    if (post.createdBy?.email) {
                        const user = await users.findOne({ email: post.createdBy.email });
                        if (user) {
                            updates['createdBy.id'] = user._id;
                            console.log(`  Fixed using email: ${post.createdBy.email} -> ${user._id}`);
                            needsUpdate = true;
                        }
                    }
                }
            }

            // Check members array
            if (post.members && Array.isArray(post.members)) {
                const fixedMembers = [];
                let membersNeedFix = false;

                for (const member of post.members) {
                    const memberId = member.id;
                    if (memberId && !(memberId instanceof ObjectId)) {
                        const idStr = String(memberId);
                        if (!ObjectId.isValid(idStr) || idStr.length !== 24) {
                            console.log(`  Invalid member.id for ${member.name}: ${idStr}`);

                            // Try to find user by name or keep as is if we can find by email
                            const user = await users.findOne({
                                $or: [
                                    { name: member.name },
                                    { email: member.email }
                                ]
                            });

                            if (user) {
                                fixedMembers.push({ ...member, id: user._id });
                                console.log(`    Fixed: ${member.name} -> ${user._id}`);
                                membersNeedFix = true;
                            } else {
                                fixedMembers.push(member); // Keep original
                            }
                        } else {
                            // Valid string, convert to ObjectId
                            fixedMembers.push({ ...member, id: new ObjectId(idStr) });
                        }
                    } else {
                        fixedMembers.push(member);
                    }
                }

                if (membersNeedFix) {
                    updates.members = fixedMembers;
                    needsUpdate = true;
                }
            }

            // Apply updates
            if (needsUpdate && Object.keys(updates).length > 0) {
                await teamPosts.updateOne(
                    { _id: post._id },
                    { $set: updates }
                );
                fixedCount++;
                console.log(`  ✅ Updated post`);
            }
        }

        console.log(`\n=== Summary ===`);
        console.log(`Fixed ${fixedCount} posts`);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

fixUserIds();
