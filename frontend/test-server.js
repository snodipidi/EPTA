// Простой сервер для тестирования оптимизации LCP
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const server = http.createServer((req, res) => {
    let filePath = '.' + req.url.split('?')[0];
    if (filePath === './') {
        filePath = './test-lcp.html';
    }

    // Static assets from Vite public/ (e.g. /mock/*.svg)
    if (filePath.startsWith('./mock/')) {
        filePath = './public' + filePath.slice(1);
    }
    
    const extname = path.extname(filePath);
    let contentType = 'text/html';
    
    switch (extname) {
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
        case '.json':
            contentType = 'application/json';
            break;
        case '.png':
            contentType = 'image/png';
            break;
        case '.jpg':
            contentType = 'image/jpg';
            break;
        case '.svg':
            contentType = 'image/svg+xml';
            break;
    }
    
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error: ' + error.code);
            }
        } else {
            // Добавляем заголовки для тестирования кэширования и оптимизации
            res.writeHead(200, {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600',
                'X-Content-Type-Options': 'nosniff'
            });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`Сервер для тестирования LCP запущен на порту ${PORT}`);
    console.log(`Откройте http://localhost:${PORT} в браузере`);
    console.log('');
    console.log('Инструкции для тестирования:');
    console.log('1. Откройте Chrome DevTools (F12)');
    console.log('2. Перейдите во вкладку "Network"');
    console.log('3. Перезагрузите страницу (Ctrl+R)');
    console.log('4. Проверьте колонку "Priority" для изображений');
    console.log('5. LCP элемент должен иметь приоритет "High"');
});