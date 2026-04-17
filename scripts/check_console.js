const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        
        // Catch console events
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', error => console.error('PAGE ERROR:', error.message));
        page.on('requestfailed', request =>
            console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText)
        );

        console.log('Navigating to page...');
        await page.goto('http://localhost:3000/busca', { waitUntil: 'networkidle2', timeout: 15000 });
        
        console.log('Waiting for map...');
        await page.waitForTimeout(3000);
        
        await browser.close();
        console.log('Done.');
    } catch (err) {
        console.error('SCRIPT ERROR:', err.message);
    }
})();
