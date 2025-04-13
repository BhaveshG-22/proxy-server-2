require('dotenv').config();
const express = require('express');
const httpProxy = require('http-proxy');
const app = express();

const proxy = httpProxy.createProxy();
const PORT = process.env.PORT || 9001;
const BASE_PATH = process.env.BASE_PATH ;
const PRIMARY_DOMAIN = process.env.PRIMARY_DOMAIN || 'shipyard.bhaveshg.dev';

// Debug middleware to log request details
app.use((req, res, next) => {
  console.log('Request received:');
  console.log(`- URL: ${req.url}`);
  console.log(`- Method: ${req.method}`);
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
        <p>Access your project using the subdomain pattern: <pre><em>project-id</em>.${PRIMARY_DOMAIN}</pre></p>
        <p>For example: <pre>it-works-my-fam.${PRIMARY_DOMAIN}</pre></p>
        <p>This will proxy to: <pre>${BASE_PATH}/it-works-my-fam/</pre></p>
      </body>
    </html>
  `);
});

// Subdomain-based handling
app.use((req, res) => {
  const hostHeader = req.headers.host || '';
  
  // Extract subdomain as project ID
  let subdomain = 'default';
  
  if (hostHeader.includes(PRIMARY_DOMAIN)) {
    const parts = hostHeader.split('.');
    if (parts.length > 2) {
      // We have a subdomain
      subdomain = parts[0];
    }
  } else {
    // Handle local development or direct IP access
    // For example: 400.localhost:9001
    const parts = hostHeader.split('.');
    if (parts.length > 1 && !hostHeader.match(/^\d+\.\d+\.\d+\.\d+/)) {
      subdomain = parts[0]; // First part is the project ID
    }
  }
  
  console.log(`Extracted subdomain: ${subdomain}`);
  
  // Clean up URL path if needed
  let targetPath = req.url;
  if (targetPath.includes('/react-gh-pages/')) {
    targetPath = targetPath.replace('/react-gh-pages', '');
  }
  
  // Ensure path starts with a slash
  if (!targetPath.startsWith('/')) {
    targetPath = '/' + targetPath;
  }
  
  // Add index.html to root paths
  if (targetPath === '/') {
    targetPath = '/index.html';
  }
  
  // Build target URL - pointing to specific folder in S3
  const targetUrl = `${BASE_PATH}/${subdomain}`;
  console.log(`Proxying to S3 target: ${targetUrl}`);
  console.log(`Target path: ${targetPath}`);
  
  // Proxy the request to S3
  return proxy.web(req, res, {
    target: targetUrl,
    changeOrigin: true,
    prependPath: false, 
    path: targetPath
  }, (err) => {
    if (err) {
      console.error('Proxy error:', err);
      res.status(500).send(`Proxy error occurred: ${err.message}`);
    }
  });
});

// Modify proxy requests as needed
proxy.on('proxyReq', (proxyReq, req, res) => {
  console.log(`Proxying to: ${proxyReq.path}`);
});

// Handle proxy errors
proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err);
  if (!res.headersSent) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <head>
          <title>Proxy Error</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            .error { color: red; font-weight: bold; }
            pre { background: #f4f4f4; padding: 10px; border-radius: 5px; }
          </style>
        </head>
        <body>
          <h1 class="error">Proxy Error</h1>
          <p>An error occurred while connecting to the target server.</p>
          <pre>${err.message}</pre>
          <p>Please check the project ID and try again.</p>
        </body>
      </html>
    `);
  }
});

app.listen(PORT, () => {
  console.log(`Reverse Proxy running on port ${PORT}`);
  console.log(`BASE_PATH set to: ${BASE_PATH}`);
  console.log(`PRIMARY_DOMAIN set to: ${PRIMARY_DOMAIN}`);
});