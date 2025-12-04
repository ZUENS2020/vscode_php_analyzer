import express from 'express';
import * as path from 'path';
import cors from 'cors';
import { Server } from 'http';
import { CodeGraph } from '../types';

export class GraphServer {
    private app: express.Application;
    private server?: Server;
    private port: number;
    private webDir: string;
    private analysisData: Map<string, any> = new Map();
    private currentGraphData: {
        code?: CodeGraph;
        inheritance?: CodeGraph;
        dataflow?: CodeGraph;
        attackchain?: CodeGraph;
    } = {};

    constructor(port: number = 3000, webDirectory?: string) {
        this.port = port;
        // Allow custom web directory or compute default based on output structure
        this.webDir = webDirectory || path.join(__dirname, '..', '..', 'web');
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
    }

    private setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        
        // Serve static files from web directory
        this.app.use(express.static(this.webDir));
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

        // Enhanced data flow analysis endpoint
        this.app.post('/api/analysis/dataflow', (req, res) => {
            const { filePath, analysis } = req.body;
            
            if (!filePath) {
                res.status(400).json({ error: 'Missing filePath' });
                return;
            }
            
            // Return current data flow graph data
            if (this.currentGraphData.dataflow) {
                res.json({
                    success: true,
                    filePath: filePath,
                    analysis: analysis || 'comprehensive',
                    data: this.currentGraphData.dataflow
                });
            } else {
                res.status(404).json({ 
                    error: 'No data flow analysis available. Run analysis in VS Code first.',
                    filePath: filePath
                });
            }
        });

        // Serve main page
        // Note: Rate limiting is not required as this server only listens on localhost
        // and is exclusively for use by the VS Code extension's graph visualization
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(this.webDir, 'index.html'));
        });
    }

    async start(): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                // Explicitly bind to localhost only for security
                this.server = this.app.listen(this.port, 'localhost', () => {
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
