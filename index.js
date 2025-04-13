require('dotenv').config()
const express = require('express')
const httpProxy = require('http-proxy')

const app = express()
const proxy = httpProxy.createProxy()

app.get('/', (req, res) => {
    res.send('Server is alive!');
});

app.use((req, res) => {
    const pathParts = req.url.split('/').filter(Boolean); // ['it-works-my-fam', 'index.html']
    const projectID = pathParts[0]; // e.g., "it-works-my-fam"

    if (!projectID) {
        return res.status(400).send('Project ID missing in path');
    }

    // Remove projectID from the path for forwarding
    req.url = '/' + pathParts.slice(1).join('/');
    if (req.url === '/') req.url = '/index.html';

    const target = `${process.env.BASE_PATH}/${projectID}`;
    console.log(`Proxying to: ${target}${req.url}`);

    return proxy.web(req, res, { target, changeOrigin: true });
});

proxy.on('error', (err, req, res) => {
    console.error('Proxy error:', err.message);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Something went wrong.');
});

app.listen(9001, () => console.log(`Reverse Proxy Running on http://localhost:9001`));
