"""
Playwright-based Browser Automation Agent for Back-Office POS Dashboards.
Bypasses lack of public APIs by automating export downloads and menu imports.
"""

import os

from playwright.async_api import TimeoutError, async_playwright


class POSBrowserAgent:
    def __init__(self, portal_url: str, username: str, password: str):
        self.portal_url = portal_url
        self.username = username
        self.password = password

    async def execute_export_workflow(
        self, target_workflow: str, output_path: str = "generated/export.csv"
    ) -> bool:
        """
        Automates back-office navigation to extract CSV datasets.
        Supported target_workflows: 'loyalty', 'coupons', 'payroll'
        """
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--disable-blink-features=AutomationControlled"],
            )
            context = await browser.new_context(viewport={"width": 1280, "height": 800})
            page = await context.new_page()

            try:
                # Step 1: Authentication
                await page.goto(self.portal_url, wait_until="networkidle")
                await page.fill("input[type='email'], input[id='username']", self.username)
                await page.fill("input[type='password'], input[id='password']", self.password)
                await page.click("button[type='submit'], input[type='submit']")
                await page.wait_for_load_state("networkidle")

                # Step 2: Navigate workflow route
                if target_workflow == "loyalty":
                    await page.click("text=Marketing, text=Loyalty, a[href*='customers']")
                    await page.wait_for_selector("button[id='export-btn'], .btn-export")

                elif target_workflow == "coupons":
                    await page.click("text=Reports, text=Finance, text=Discounts")
                    await page.wait_for_selector("text=Export Ledger, .download-discounts")

                elif target_workflow == "payroll":
                    await page.click("text=Labor, text=Timecards, text=Shifts")
                    await page.wait_for_selector("input[id='start-date']")
                    await page.fill("input[id='start-date']", "2026-01-01")
                    await page.click("button:has-text('Apply'), .filter-submit")

                # Step 3: Trigger file stream
                async with page.expect_download() as download_info:
                    await page.click("button:has-text('Export'), .export-action, text=Download CSV")
                download = await download_info.value

                # Step 4: Write to output
                await download.save_as(output_path)
                print(f"[SUCCESS] Workflow '{target_workflow}' saved to: {output_path}")
                return True

            except TimeoutError:
                print(f"[ERROR] Browser automation timed out on '{target_workflow}'. Viewport/state mismatch.")
                return False
            finally:
                await context.close()
                await browser.close()

    async def execute_menu_import_workflow(
        self, csv_file_path: str, upload_selector: str = "input[type='file']"
    ) -> bool:
        """Automates bulk menu catalog ingestion via file upload."""
        if not os.path.exists(csv_file_path):
            raise FileNotFoundError(f"Source import file missing: {csv_file_path}")

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()

            try:
                await page.goto(self.portal_url, wait_until="networkidle")
                await page.fill("input[id='username']", self.username)
                await page.fill("input[id='password']", self.password)
                await page.click("button[type='submit']")
                await page.wait_for_load_state("networkidle")

                # Locate catalog panel
                await page.click("text=Menu, text=Inventory, text=Catalog")
                await page.click("text=Bulk Management, text=Import")

                # Populate file directly
                await page.set_input_files(upload_selector, csv_file_path)

                # Commit
                await page.click("button:has-text('Confirm Import'), .commit-upload")
                await page.wait_for_selector(
                    "text=Import Completed Successfully, .alert-success", timeout=60000
                )
                print("[SUCCESS] Menu catalog payload integrated into POS.")
                return True

            except Exception as e:
                print(f"[FAIL] Upload sequence failed: {str(e)}")
                return False
            finally:
                await browser.close()
