const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Hàm proxy chung cho cutoolsfree.fun
const proxyCutools = async (req, res, apiType, providedKey = null) => {
    try {
        // Xây dựng URL
        let targetUrl = `https://cutoolsfree.fun/?api=${apiType}`;
        
        // Nếu có key, thêm vào query string
        if (providedKey) {
            targetUrl += `&key=${encodeURIComponent(providedKey)}`;
        }
        
        // Headers giả lập trình duyệt
        const headers = {
            'Referer': 'https://cutoolsfree.fun',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
            'Connection': 'keep-alive',
            'Host': 'cutoolsfree.fun'
        };

        console.log(`🔄 Đang gọi API: ${targetUrl}`);
        
        // Gọi API gốc
        const response = await axios.get(targetUrl, { 
            headers: headers,
            timeout: 15000,
            validateStatus: function (status) {
                return status >= 200 && status < 600;
            }
        });

        console.log(`📊 Status trả về: ${response.status}`);
        
        // Xử lý response
        if (response.status === 403) {
            return res.status(403).json({
                success: false,
                error: 'API trả về 403 Forbidden',
                message: 'API yêu cầu xác thực (cần key) hoặc đã bị chặn',
                statusCode: 403,
                timestamp: new Date().toISOString(),
                solution: 'Cần có key hợp lệ từ cutoolsfree.fun để truy cập API này'
            });
        }
        
        if (response.status === 200) {
            // Thử parse JSON, nếu không được trả về text
            let data;
            try {
                data = typeof response.data === 'string' 
                    ? JSON.parse(response.data) 
                    : response.data;
            } catch (e) {
                data = response.data;
            }
            
            return res.json({
                success: true,
                data: data,
                statusCode: response.status,
                timestamp: new Date().toISOString()
            });
        }
        
        // Xử lý các status code khác
        return res.status(response.status).json({
            success: false,
            error: `API trả về status ${response.status}`,
            data: response.data,
            statusCode: response.status,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Proxy Error:', error.message);
        
        let errorMessage = 'Không thể lấy dữ liệu từ API gốc';
        let statusCode = 500;
        
        if (error.code === 'ECONNREFUSED') {
            errorMessage = 'Không thể kết nối đến server';
            statusCode = 502;
        } else if (error.code === 'ETIMEDOUT') {
            errorMessage = 'Request timeout';
            statusCode = 504;
        } else if (error.response) {
            errorMessage = `Server trả về lỗi: ${error.response.status}`;
            statusCode = error.response.status;
        }
        
        return res.status(statusCode).json({
            success: false,
            error: errorMessage,
            details: error.message,
            statusCode: statusCode,
            timestamp: new Date().toISOString()
        });
    }
};

// ==================== ROUTES ====================

// API lc79_hu không key
app.get('/api/tx', async (req, res) => {
    await proxyCutools(req, res, 'lc79_hu');
});

// API lc79_hu với key
app.get('/api/cutools/hu/with-key', async (req, res) => {
    const { key } = req.query;
    if (!key) {
        return res.status(400).json({
            success: false,
            error: 'Thiếu key',
            message: 'Vui lòng cung cấp key qua query parameter: ?key=YOUR_KEY'
        });
    }
    await proxyCutools(req, res, 'lc79_hu', key);
});

// API lc79_md5 không key
app.get('/api/md5', async (req, res) => {
    await proxyCutools(req, res, 'lc79_md5');
});

// API lc79_md5 với key
app.get('/api/cutools/md5/with-key', async (req, res) => {
    const { key } = req.query;
    if (!key) {
        return res.status(400).json({
            success: false,
            error: 'Thiếu key',
            message: 'Vui lòng cung cấp key qua query parameter: ?key=YOUR_KEY'
        });
    }
    await proxyCutools(req, res, 'lc79_md5', key);
});

// API tổng hợp - có thể chọn loại API qua query
app.get('/api/all', async (req, res) => {
    const { type, key } = req.query;
    const apiType = type || 'lc79_hu';
    await proxyCutools(req, res, apiType, key);
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Proxy server đang hoạt động',
        timestamp: new Date().toISOString(),
        endpoints: {
            hu: '/api/tx',
            huWithKey: '/api/cutools/hu/with-key?key=YOUR_KEY',
            md5: '/api/md5',
            md5WithKey: '/api/cutools/md5/with-key?key=YOUR_KEY',
            flexible: '/api/cutools?type=lc79_hu&key=YOUR_KEY'
        }
    });
});

// Test tất cả API
app.get('/api/test-all', async (req, res) => {
    const endpoints = [
        { name: 'lc79_hu', url: 'https://cutoolsfree.fun/?api=lc79_hu' },
        { name: 'lc79_md5', url: 'https://cutoolsfree.fun/?api=lc79_md5' }
    ];
    
    const results = [];
    
    for (const endpoint of endpoints) {
        try {
            const response = await axios.get(endpoint.url, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 8000,
                validateStatus: () => true
            });
            
            results.push({
                name: endpoint.name,
                url: endpoint.url,
                status: response.status,
                success: response.status === 200,
                dataLength: response.data ? 
                    (typeof response.data === 'string' ? 
                        response.data.length : 
                        JSON.stringify(response.data).length) : 0
            });
        } catch (error) {
            results.push({
                name: endpoint.name,
                url: endpoint.url,
                status: 'ERROR',
                success: false,
                error: error.message
            });
        }
    }
    
    res.json({
        success: true,
        results: results,
        timestamp: new Date().toISOString()
    });
});

// ==================== GIAO DIỆN WEB ====================
app.get('/', (req, res) => {
});

// Khởi động server
app.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════════════════════╗
    ║               🚀 Proxy Server Started                ║
    ╠══════════════════════════════════════════════════════╣
    ║  📍 Local:    http://localhost:${PORT}              ║
    ╠══════════════════════════════════════════════════════╣
    `);
});
