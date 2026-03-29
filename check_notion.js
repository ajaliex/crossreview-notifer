require('dotenv').config();
const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_KEY });
const blockId = process.env.NOTION_DB_ID;

async function check() {
    try {
        console.log("Checking block ID:", blockId);
        let current = await notion.blocks.retrieve({ block_id: blockId });
        console.log(`Block ${current.id} archived: ${current.archived}`);

        // Check ancestors
        while (current.parent) {
            console.log("\nParent:", current.parent);
            if (current.parent.type === 'page_id') {
                current = await notion.pages.retrieve({ page_id: current.parent.page_id });
                console.log(`Page ${current.id} archived: ${current.archived}, url: ${current.url}`);
            } else if (current.parent.type === 'block_id') {
                current = await notion.blocks.retrieve({ block_id: current.parent.block_id });
                console.log(`Block ${current.id} archived: ${current.archived}`);
            } else if (current.parent.type === 'database_id') {
                current = await notion.databases.retrieve({ database_id: current.parent.database_id });
                console.log(`Database ${current.id} archived: ${current.archived}, url: ${current.url}`);
            } else if (current.parent.type === 'workspace') {
                console.log("Workspace reached.");
                break;
            } else {
                console.log("Unknown parent type:", current.parent.type);
                break;
            }
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

check();
