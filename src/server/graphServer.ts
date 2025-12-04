import express from 'express';
import * as path from 'path';
import cors from 'cors';
import { Server } from 'http';
import { CodeGraph } from '../types';

export class GraphServer {
    private app: express.Application;
    private server?: Server;
    private port: number;
    private analysisData: Map<string, any> = new Map();
    private currentGraphData: {
        code?: CodeGraph;
        inheritance?: CodeGraph;
        dataflow?: CodeGraph;
        attackchain?: CodeGraph;
    } = {};

    constructor(port: number = 3000) {
        this.port = port;
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
    }

    private setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        
        // Serve static files from web directory
        const webDir = path.join(__dirname, '..', '..', 'web');
        this.app.use(express.static(webDir));
    }

    private setupRoutes() {
        // Health check
        this.app.get('/api/health', (req, res) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        });

        // Get analysis data by file hash
        this.app.get('/api/analysis/:fileHash', (req, res) => {
            const { fileHash } = req.params;
            const data = this.analysisData.get(fileHash);
            
            if (data) {
                res.json(data);
            } else {
                res.status(404).json({ error: 'Analysis not found' });
            }
        });

        // Get code structure graph
        this.app.get('/api/graph/code', (req, res) => {
            if (this.currentGraphData.code) {
                res.json(this.currentGraphData.code);
            } else {
                res.status(404).json({ error: 'No code graph data available' });
            }
        });

        // Get inheritance graph
        this.app.get('/api/graph/inheritance', (req, res) => {
            if (this.currentGraphData.inheritance) {
                res.json(this.currentGraphData.inheritance);
            } else {
                res.status(404).json({ error: 'No inheritance graph data available' });
            }
        });

        // Get data flow graph
        this.app.get('/api/graph/dataflow', (req, res) => {
            if (this.currentGraphData.dataflow) {
                res.json(this.currentGraphData.dataflow);
            } else {
                res.status(404).json({ error: 'No dataflow graph data available' });
            }
        });

        // Get attack chain graph
        this.app.get('/api/graph/attackchain', (req, res) => {
            if (this.currentGraphData.attackchain) {
                res.json(this.currentGraphData.attackchain);
            } else {
                res.status(404).json({ error: 'No attack chain graph data available' });
            }
        });

        // Submit new analysis (for future use)
        this.app.post('/api/analysis', (req, res) => {
            const { fileHash, data } = req.body;
            
            if (!fileHash || !data) {
                res.status(400).json({ error: 'Missing fileHash or data' });
                return;
            }
            
            this.analysisData.set(fileHash, data);
            res.json({ success: true, fileHash });
        });

        // Serve main page
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '..', '..', 'web', 'index.html'));
        });
    }

    async start(): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                this.server = this.app.listen(this.port, () => {
                    console.log(`Graph server running on http://localhost:${this.port}`);
                    resolve(true);
                });

                this.server.on('error', (error: any) => {
                    if (error.code === 'EADDRINUSE') {
                        console.error(`Port ${this.port} is already in use`);
                    } else {
                        console.error('Server error:', error);
                    }
                    resolve(false);
                });
            } catch (error) {
                console.error('Failed to start server:', error);
                resolve(false);
            }
        });
    }

    async stop(): Promise<void> {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    console.log('Graph server stopped');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    updateGraphData(type: 'code' | 'inheritance' | 'dataflow' | 'attackchain', graph: CodeGraph) {
        this.currentGraphData[type] = graph;
    }

    getPort(): number {
        return this.port;
    }

    isRunning(): boolean {
        return this.server !== undefined && this.server.listening;
    }
}
