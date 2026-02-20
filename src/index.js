require('dotenv').config();
const { chromium } = require('playwright');
const { Client } = require('@notionhq/client');

// Configuration
const STUDYING_URL = 'https://member.studying.jp/login/';
// The specific review page URL might need adjustment based on the user's course
// For now, we'll try to navigate or use a likely URL. 
// If the user has a specific URL, they should set it in the environment or we can extract it.
// Assuming the user wants the "AI Problem Review" which is usually prominent.
const REVIEW_PAGE_URL = process.env.STUDYING_REVIEW_URL || 'https://member.studying.jp/crossreview/';

// Notion Setup
const notion = new Client({ auth: process.env.NOTION_KEY });
const NOTION_DB_ID = process.env.NOTION_DB_ID;

const GENRES = ['スマート問題集', '計算', '理論'];

async function main() {
    console.log('Starting Studying to Notion Sync...');

    if (!process.env.STUDYING_EMAIL || !process.env.STUDYING_PASSWORD) {
        throw new Error('Missing STUDYING_EMAIL or STUDYING_PASSWORD environment variables.');
    }
    if (!process.env.NOTION_KEY || !process.env.NOTION_DB_ID) {
        throw new Error('Missing NOTION_KEY or NOTION_DB_ID environment variables.');
    }

    // Check for placeholders
    if (process.env.NOTION_DB_ID === 'your_notion_database_id' || process.env.NOTION_KEY === 'your_notion_integration_token') {
        throw new Error('Please update .env file with your actual Notion credentials. Found default placeholders.');
    }

    const browser = await chromium.launch({ headless: true }); // Set to false for debugging
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        // 1. Login
        console.log('Logging in...');
        await page.goto(STUDYING_URL);

        // Wait for the form to be visible to ensure we are on the right page
        // Trying multiple selectors for email input
        const emailSelector = 'input[type="email"], input[name="loginId"], input[name*="mail"], input[type="text"]';
        // Note: input[type="text"] is very broad, so we rely on order or being specific if possible.
        // Better:
        await page.fill('input[type="email"], input[name="loginId"], input[name*="mail"]', process.env.STUDYING_EMAIL);
        await page.fill('input[type="password"]', process.env.STUDYING_PASSWORD);

        // Click login button
        // Try to find the button by text "ログインする" or typical submit types
        await page.click('a:has-text("ログインする"), button:has-text("ログインする"), input[type="submit"]');

        // Wait for navigation to complete (member home)
        await page.waitForURL('**/member.studying.jp/**');
        console.log('Login successful.');

        // 2. Navigate to AI Review Page
        console.log('Navigating to Review Page...');
        // Force direct navigation to ensure we get to the right place.
        // The dashboard link selector was ambiguous and causing strict mode errors.
        await page.goto('https://member.studying.jp/crossreview/');


        await page.waitForLoadState('networkidle');

        // 3. Scrape Data
        // 3. Scrape Data
        const results = {};

        // Defined based on HTML analysis
        const GENRES_CONFIG = [
            { name: 'スマート問題集', id: '#radio_deck_1' },
            { name: '計算', id: '#radio_deck_2' },
            { name: '理論', id: '#radio_deck_3' }
        ];

        for (const genreConfig of GENRES_CONFIG) {
            console.log(`Processing genre: ${genreConfig.name}`);

            try {
                // Helper function to ensure dropdown is open
                const ensureDropdownOpen = async () => {
                    const dropdownMenu = page.locator('#deckSelectArea');
                    if (!await dropdownMenu.isVisible()) {
                        console.log('  Opening dropdown...');
                        await page.locator('.dropdown__btn').click();
                        await dropdownMenu.waitFor({ state: 'visible', timeout: 3000 });
                    }
                };

                // 1. Check the target genre FIRST
                await ensureDropdownOpen();
                const targetCheckbox = page.locator(genreConfig.id);
                if (!await targetCheckbox.isChecked()) {
                    console.log(`  Checking target: ${genreConfig.name}`);
                    const label = page.locator(`label[for="${genreConfig.id.replace('#', '')}"]`);
                    if (await label.isVisible()) {
                        await label.click();
                    } else {
                        await targetCheckbox.check({ force: true });
                    }
                    await page.waitForTimeout(500);
                } else {
                    console.log(`  Target ${genreConfig.name} is already checked.`);
                }

                // 2. Uncheck ALL OTHER genres
                await ensureDropdownOpen();
                for (const otherGenre of GENRES_CONFIG) {
                    if (otherGenre.id === genreConfig.id) continue;

                    const otherCheckbox = page.locator(otherGenre.id);
                    if (await otherCheckbox.isChecked()) {
                        console.log(`  Unchecking other: ${otherGenre.name}`);
                        const otherLabel = page.locator(`label[for="${otherGenre.id.replace('#', '')}"]`);
                        if (await otherLabel.isVisible()) {
                            await otherLabel.click();
                        } else {
                            await otherCheckbox.uncheck({ force: true });
                        }
                        await page.waitForTimeout(300);
                    }
                }

                // 3. Apply changes (Click "Select" button)
                console.log('  Applying changes...');
                await page.click('#range_deck_apply');

                // 4. Wait for update
                await page.waitForTimeout(3000);

                // 5. Scrape "Remaining X Questions"
                const countElement = await page.$('#aiPracticeNumTotal');
                let count = 0;
                if (countElement) {
                    const countText = await countElement.innerText();
                    count = parseInt(countText, 10) || 0;
                }

                console.log(`Found count for ${genreConfig.name}: ${count}`);
                results[genreConfig.name] = count;

            } catch (e) {
                console.error(`Error processing ${genreConfig.name}:`, e);
                results[genreConfig.name] = 0;
            }
        }



        console.log('Final Results:', results);

        // 4. Send to Notion (Update Block)
        const blockId = process.env.NOTION_DB_ID;
        if (Object.keys(results).length > 0 && blockId) {
            console.log(`Updating Notion Block ID: ${blockId}...`);

            const dateStr = new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
            let contentText = `${dateStr} の復習問題数:\n`;
            for (const [key, value] of Object.entries(results)) {
                contentText += `- ${key}: ${value}問\n`;
            }

            try {
                // Determine block type or just try to update as paragraph
                // For simplicity, we assume the user provided ID is for a text-capable block (paragraph, callout, etc.)
                // We will try to append children to the block if it's a container, OR update the block itself if it's a text block.
                // Re-reading user request: "output destination to be a text box". 
                // This usually means they want to *replace* the text in that box or *append* to it.
                // If we replace, we overwrite history. If we append, we keep history.
                // "Output destination ... is text box" -> sounds like a dashboard widget.
                // Let's UPDATE the block content to show the *current* status.

                await notion.blocks.update({
                    block_id: blockId,
                    paragraph: {
                        rich_text: [
                            {
                                type: 'text',
                                text: {
                                    content: contentText
                                }
                            }
                        ]
                    }
                });
                console.log('Notion block updated successfully.');

            } catch (notionError) {
                console.error('Error updating Notion block:', notionError);
                // Fallback: If update fails (e.g. not a paragraph), try appending? 
                // Or just log error.
            }
        } else {
            console.log('No results to send or Block ID missing.');
        }

    } catch (error) {
        console.error('An error occurred:', error);

        // Debugging: Take a screenshot if page exists
        try {
            if (typeof page !== 'undefined') {
                console.log(' taking debug screenshot...');
                await page.screenshot({ path: 'debug_error.png', fullPage: true });
                console.log('Saved screenshot to debug_error.png');
                console.log('Current URL:', page.url());
                console.log('Current Title:', await page.title());
            }
        } catch (screenshotError) {
            console.error('Could not take screenshot:', screenshotError);
        }

        process.exit(1);
    } finally {
        await browser.close();
    }
}

main();
