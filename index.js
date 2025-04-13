require('dotenv').config();
const express = require('express');
const httpProxy = require('http-proxy');
const app = express();

const proxy = httpProxy.createProxy();
const PORT = process.env.PORT || 9001;
const BASE_PATH = process.env.BASE_PATH;

// Debug middleware to log request details
app.use((req, res, next) => {
    console.log('Request received:');
    console.log(`- URL: ${req.url}`);
    console.log(`- Host header: ${req.headers.host}`);
    next();
});

// Root path handler with domain info
app.get('/', (req, res) => {
    const host = req.headers.host || 'unknown';
    res.send(`
    <html>
      <head>
        <title>Proxy Server Status</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          pre { background: #f4f4f4; padding: 10px; border-radius: 5px; }
          .status { color: green; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Proxy Server Status</h1>
        <p class="status">Server is alive!</p>
        <p>You accessed this server from: <strong>${host}</strong></p>
        <h2>How to use this proxy:</h2>
        <p>Access your project using the subdomain pattern: <pre>[project-id].${host.includes(':') ? host.split(':')[0] : host}</pre></p>
        <p>For example: <pre>400.${host.includes(':') ? host.split(':')[0] : host}</pre></p>
        <p>This will proxy to: <pre>${BASE_PATH}/400/</pre></p>
      </body>
    </html>
  `);
});

// Handle all other requests with proxy
app.use((req, res) => {
    // Improved subdomain extraction that handles Render's domain structure
    const hostHeader = req.headers.host || '';

    // Extract subdomain properly
    let subdomain = 'default';

    // For Render.com hosted domains
    if (hostHeader.includes('proxy-server-2-dam5.onrender.com')) {
        // Check for custom subdomain format: subdomain.proxy-server-2-dam5.onrender.com
        const parts = hostHeader.split('.');
        if (parts.length > 3) {
            // We have a subdomain
            subdomain = parts[0];
        } else {
            // Handle case where the main domain is accessed directly
            // You might want to set a default project here
            subdomain = '400'; // Default project ID if none specified
        }
    } else if (hostHeader.includes('localhost')) {
        // Local development - handle pattern like: 400.localhost:9001
        const parts = hostHeader.split('.');
        if (parts.length > 1) {
            subdomain = parts[0]; // Get the project ID from subdomain
        }
    } else {
        // Generic fallback - just take first part of hostname
        subdomain = hostHeader.split('.')[0];
    }

    console.log(`Extracted subdomain/project ID: ${subdomain}`);

    // Clean up URL path if needed
    if (req.url.includes('/react-gh-pages/')) {
        req.url = req.url.replace('/react-gh-pages', '');
        console.log(`Modified URL path: ${req.url}`);
    }

    // Build target URL - pointing to specific folder in S3
    const targetUrl = `${BASE_PATH}/${subdomain}`;
    console.log(`Proxying to S3 target: ${targetUrl}`);

    // Proxy the request to S3
    return proxy.web(req, res, {
        target: targetUrl,
        changeOrigin: true,
        prependPath: true,
        followRedirects: true // Add this for S3 redirects if needed
    }, (err) => {
        if (err) {
            console.error('Proxy error:', err);
            res.status(500).send(`Proxy error occurred: ${err.message}`);
        }
    });
});

// Modify proxy requests as needed
proxy.on('proxyReq', (proxyReq, req, res) => {
    const url = req.url;

    // Append index.html to root path
    if (url === '/' || url === '') {
        proxyReq.path += 'index.html';
        console.log(`Modified proxy path to: ${proxyReq.path}`);
    }
});

// Handle proxy errors
proxy.on('error', (err, req, res) => {
    console.error('Proxy error:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Proxy error occurred');
});

app.listen(PORT, () => {
    console.log(`Reverse Proxy running on port ${PORT}`);
    console.log(`BASE_PATH set to: ${BASE_PATH}`);
});