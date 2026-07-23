const express = require('express');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// Simple CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.static(__dirname));

const dataDir = path.join(__dirname, 'data');
const paths = {
    projects: path.join(dataDir, 'projects.json'),
    budget: path.join(dataDir, 'budget.json'),
    tenders: path.join(dataDir, 'tenders.json'),
    contracts: path.join(dataDir, 'contracts.json'),
    cashflow: path.join(dataDir, 'cashflow.json'),
    payments: path.join(dataDir, 'payments.json')
};

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Utility to read JSON async
async function readJson(filePath, defaultData) {
    try {
        if (!fs.existsSync(filePath)) {
            await fsp.writeFile(filePath, JSON.stringify(defaultData, null, 2), 'utf8');
            return defaultData;
        }
        const data = await fsp.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error(`Error reading ${filePath}:`, err);
        return defaultData;
    }
}

// Utility to write JSON async
async function writeJson(filePath, data) {
    try {
        await fsp.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error(`Error writing ${filePath}:`, err);
        return false;
    }
}

// --- GET endpoints ---
app.get('/api/projects', async (req, res) => {
    res.json(await readJson(paths.projects, { Projects: [] }));
});

app.get('/api/budget', async (req, res) => {
    res.json(await readJson(paths.budget, { Contracts: [], Payment_Claims: [], Variations: [], Documents: [] }));
});

app.get('/api/tenders', async (req, res) => {
    res.json(await readJson(paths.tenders, { Tenders: [] }));
});

app.get('/api/contracts', async (req, res) => {
    res.json(await readJson(paths.contracts, []));
});

app.get('/api/cashflow', async (req, res) => {
    res.json(await readJson(paths.cashflow, []));
});

app.get('/api/payments', async (req, res) => {
    res.json(await readJson(paths.payments, []));
});

// --- POST endpoints ---
app.post('/api/projects', async (req, res) => {
    // Allows sending either an array of projects to overwrite, or a single project to append
    let payload = req.body;
    let data = await readJson(paths.projects, { Projects: [] });
    
    if (Array.isArray(payload)) {
        data.Projects = payload;
    } else {
        data.Projects.push(payload);
    }
    
    if (await writeJson(paths.projects, data)) {
        res.json({ message: 'Projects saved successfully!' });
    } else {
        res.status(500).json({ error: 'Failed to save projects' });
    }
});

app.post('/api/budget', async (req, res) => {
    const budgetData = req.body;
    if (await writeJson(paths.budget, budgetData)) {
        res.json({ message: 'Budget data saved successfully!' });
    } else {
        res.status(500).json({ error: 'Failed to save budget data' });
    }
});

app.post('/api/tenders', async (req, res) => {
    let payload = req.body;
    let data = await readJson(paths.tenders, { Tenders: [] });
    
    if (Array.isArray(payload)) {
        data.Tenders = payload;
    } else {
        data.Tenders.push(payload);
    }

    if (await writeJson(paths.tenders, data)) {
        res.json({ message: 'Tenders saved successfully!' });
    } else {
        res.status(500).json({ error: 'Failed to save tenders' });
    }
});

app.post('/api/contracts', async (req, res) => {
    const data = req.body;
    if (await writeJson(paths.contracts, data)) {
        res.json({ message: 'Contracts saved successfully!' });
    } else {
        res.status(500).json({ error: 'Failed to save contracts' });
    }
});

app.post('/api/cashflow', async (req, res) => {
    const data = req.body;
    if (await writeJson(paths.cashflow, data)) {
        res.json({ message: 'Cashflow saved successfully!' });
    } else {
        res.status(500).json({ error: 'Failed to save cashflow' });
    }
});

app.post('/api/payments', async (req, res) => {
    const data = req.body;
    if (await writeJson(paths.payments, data)) {
        res.json({ message: 'Payments saved successfully!' });
    } else {
        res.status(500).json({ error: 'Failed to save payments' });
    }
});

app.post('/api/tenders/update', async (req, res) => {
    const updatedTender = req.body;
    const data = await readJson(paths.tenders, { Tenders: [] });
    
    const tenderIndex = data.Tenders.findIndex(t => t.tender_id === updatedTender.tender_id);
    if (tenderIndex !== -1) {
        data.Tenders[tenderIndex] = updatedTender;
        if (await writeJson(paths.tenders, data)) {
            res.json({ message: 'Tender updated successfully!' });
        } else {
            res.status(500).json({ error: 'Failed to update tender' });
        }
    } else {
        res.status(404).json({ error: 'Tender not found' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    console.log(`To view the app, open http://localhost:${PORT} in your browser.`);
});
