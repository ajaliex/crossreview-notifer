# Studying.jp to Notion Automation

This project automates the extraction of "Review Problem Counts" from Studying.jp and syncs them to a Notion Database. It uses [Playwright](https://playwright.dev/) for browser automation and [GitHub Actions](https://github.com/features/actions) for daily scheduled execution.

## Prerequisites

1.  **Node.js**: v18 or higher (for local development).
2.  **Notion Integration**:
    -   Create an integration at [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations).
    -   Get the **Internal Integration Token** (Secret).
    -   Share your target Page with this integration connection.
    -   Get the **Block ID** of the text block you want to update (see below).
3.  **Studying.jp Account**: Valid credentials.

## Notion Setup
 
 1.  Create a page in Notion where you want the report to appear.
 2.  Create a **Text Block** (or Paragraph block) on that page.
 3.  Copy the **Block ID** of that text block.
     -   Right-click the block -> "Copy link to block".
     -   The ID is the part at the end of the URL (e.g., `...#1234567890abcdef...` -> `1234567890abcdef...`).
 4.  Share the page with your Notion Integration connection.


## Local Setup

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    npx playwright install chromium
    ```
3.  Create a `.env` file in the root directory:
    ```env
    STUDYING_EMAIL=your_email@example.com
    STUDYING_PASSWORD=your_password
    NOTION_KEY=secret_xxxxxxxxxxxxxxxxxxxxxxxx
    NOTION_DB_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    # Optional: If the script can't find the review page automatically
    # STUDYING_REVIEW_URL=https://member.studying.jp/crossreview/
    ```
4.  Run the script:
    ```bash
    node src/index.js
    ```

## GitHub Actions Setup (Automated Run)

1.  Push this code to a GitHub repository.
2.  Go to **Settings** -> **Secrets and variables** -> **Actions**.
3.  Add the following **Repository Secrets**:
    -   `STUDYING_EMAIL`
    -   `STUDYING_PASSWORD`
    -   `NOTION_KEY`
    -   `NOTION_DB_ID`
    -   `STUDYING_REVIEW_URL` (Optional)
4.  The workflow is configured to run automatically at **04:00 AM JST (19:00 UTC)** every day.
5.  You can also manually trigger it from the "Actions" tab by selecting "Daily Studying Sync" -> "Run workflow".

## Troubleshooting

-   **Login Fails**: Check if Studying.jp has added CAPTCHA or changed the login form selectors.
-   **Navigation Fails**: If the script stays on the dashboard, try setting `STUDYING_REVIEW_URL` to the direct link of the AI Review page.
-   **Selectors Fail**: The site is a SPA and might have dynamic class names. The script tries to use text-based selectors ("出題範囲", "選択", etc.), but layout changes might break it. Check GitHub Action logs for details.
