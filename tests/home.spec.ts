import { test, expect } from '@playwright/test';

// Following TDD and Browser Automation rules 
// (User-Facing Locator Pattern, Auto-Wait Pattern, Test Isolation Pattern)

test.describe('Stasis AI Homepage', () => {
    test('should have the correct title and SEO metadata', async ({ page }) => {
        await page.goto('/');

        // Check title (Title is the first thing that matters for SEO and user expectation)
        await expect(page).toHaveTitle(/Stasis AI.*MAPF/);

        // Verify meta description
        const metaDescription = page.locator('meta[name="description"]');
        await expect(metaDescription).toHaveAttribute('content', /MAPF/);
    });

    test('hero section should display main calls to action', async ({ page }) => {
        await page.goto('/');

        // Test Isolation & User Facing Locators
        const runSimButton = page.getByRole('link', { name: /Run Simulation/i });
        const viewDocsButton = page.getByRole('link', { name: /View Docs/i });

        // Auto-wait ensures we don't need manual timeouts
        await expect(runSimButton).toBeVisible();
        await expect(viewDocsButton).toBeVisible();
    });

    test('feature pillars should be present', async ({ page }) => {
        await page.goto('/');

        // We expect 3 distinct pillars describing the tech
        await expect(page.getByText('Blazing Fast', { exact: true })).toBeVisible();
        await expect(page.getByText('Research-Grade', { exact: true })).toBeVisible();
        await expect(page.getByText('Fault Injection', { exact: true })).toBeVisible();
    });
});
